import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type Context = { params: Promise<{ draftId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const workspace = await requireWorkspace();
    const { draftId } = await context.params;
    const draft = await prisma.contentDraft.findFirst({ where: { id: draftId, organizationId: workspace.organization.id }, select: { id: true } });
    if (!draft) return Response.json({ error: "Draft not found." }, { status: 404 });
    const comments = await prisma.reviewComment.findMany({
      where: { draftId },
      include: { user: { select: { id: true, name: true, image: true } } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({ comments });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const workspace = await requireWorkspace();
    if (workspace.role === OrganizationRole.VIEWER) return Response.json({ error: "Viewers cannot comment." }, { status: 403 });
    const { draftId } = await context.params;
    const input = await request.json() as { body?: string };
    const body = input.body?.trim();
    if (!body || body.length > 10_000) return Response.json({ error: "Comment must contain 1–10,000 characters." }, { status: 400 });
    const draft = await prisma.contentDraft.findFirst({ where: { id: draftId, organizationId: workspace.organization.id }, select: { id: true } });
    if (!draft) return Response.json({ error: "Draft not found." }, { status: 404 });
    const comment = await prisma.$transaction(async tx => {
      const created = await tx.reviewComment.create({ data: { draftId, userId: workspace.userId, body }, include: { user: { select: { id: true, name: true, image: true } } } });
      await tx.auditEvent.create({ data: { organizationId: workspace.organization.id, actorId: workspace.userId, action: "COMMENTED", entityType: "ContentDraft", entityId: draftId } });
      return created;
    });
    return Response.json({ comment }, { status: 201 });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
