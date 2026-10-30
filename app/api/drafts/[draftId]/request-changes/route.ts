import { ContentStatus, OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type Context = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.REVIEWER]);
    const { draftId } = await context.params;
    const input = await request.json().catch(() => ({})) as { note?: string };
    const note = typeof input.note === "string" ? input.note.trim().slice(0, 5000) : null;
    const result = await prisma.$transaction(async tx => {
      const draft = await tx.contentDraft.findFirst({ where: { id: draftId, organizationId: workspace.organization.id } });
      if (!draft) return { error: "Draft not found.", status: 404 as const };
      if (draft.status !== ContentStatus.IN_REVIEW) return { error: "Only content in review can receive a decision.", status: 409 as const };
      await tx.contentDraft.update({ where: { id: draftId }, data: { status: ContentStatus.CHANGES_REQUESTED } });
      await tx.approvalEvent.create({ data: { draftId, actorId: workspace.userId, action: "CHANGES_REQUESTED", note } });
      await tx.auditEvent.create({ data: { organizationId: workspace.organization.id, actorId: workspace.userId, action: "CHANGES_REQUESTED", entityType: "ContentDraft", entityId: draftId } });
      return { changesRequested: true };
    });
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
