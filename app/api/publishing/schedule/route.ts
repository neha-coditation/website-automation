import { randomUUID } from "node:crypto";
import { ContentStatus, OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    const posts = await prisma.scheduledPost.findMany({
      where: { organizationId: workspace.organization.id },
      include: {
        draft: { select: { id: true, title: true, status: true, channel: true } },
        socialAccount: { select: { id: true, provider: true, displayName: true } },
        attempts: {
          orderBy: { attemptNumber: "desc" },
          take: 5,
          select: { attemptNumber: true, status: true, responseCode: true, errorMessage: true, finishedAt: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    });
    return Response.json({ posts });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.EDITOR]);
    const input = await request.json() as { draftId?: string; socialAccountId?: string; scheduledAt?: string };
    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (!input.draftId || !input.socialAccountId || !scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return Response.json({ error: "draftId, socialAccountId and a valid scheduledAt are required." }, { status: 400 });
    }
    if (scheduledAt.getTime() < Date.now() + 60_000) {
      return Response.json({ error: "Schedule the post at least one minute in the future." }, { status: 400 });
    }
    const result = await prisma.$transaction(async tx => {
      const draft = await tx.contentDraft.findFirst({
        where: { id: input.draftId, organizationId: workspace.organization.id },
      });
      if (!draft) return { error: "Draft not found.", status: 404 as const };
      if (draft.status !== ContentStatus.APPROVED) {
        return { error: "Only explicitly approved content can be scheduled.", status: 409 as const };
      }
      const approval = await tx.approvalEvent.findFirst({
        where: { draftId: draft.id, action: "APPROVED" },
        select: { id: true },
      });
      if (!approval) return { error: "An approval record is required before scheduling.", status: 409 as const };
      const account = await tx.socialAccount.findFirst({
        where: { id: input.socialAccountId, organizationId: workspace.organization.id, provider: "LINKEDIN" },
      });
      if (!account) return { error: "Connected LinkedIn account not found.", status: 404 as const };
      if (account.tokenExpiresAt && account.tokenExpiresAt <= new Date()) {
        return { error: "LinkedIn access token has expired. Reconnect the account before scheduling.", status: 409 as const };
      }
      const post = await tx.scheduledPost.create({
        data: {
          organizationId: workspace.organization.id,
          draftId: draft.id,
          socialAccountId: account.id,
          scheduledAt,
          idempotencyKey: randomUUID(),
        },
      });
      await tx.contentDraft.update({
        where: { id: draft.id },
        data: { status: ContentStatus.SCHEDULED, scheduledAt },
      });
      await tx.auditEvent.create({
        data: {
          organizationId: workspace.organization.id,
          actorId: workspace.userId,
          action: "SCHEDULED",
          entityType: "ScheduledPost",
          entityId: post.id,
          metadata: { draftId: draft.id, scheduledAt: scheduledAt.toISOString() },
        },
      });
      return { post };
    });
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
