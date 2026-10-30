import { ContentStatus, OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeDraftHtml } from "@/lib/content/sanitize";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    const drafts = await prisma.contentDraft.findMany({
      where: { organizationId: workspace.organization.id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return Response.json({ drafts });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.EDITOR]);
    const body = await request.json() as { title?: string; body?: string; channel?: string; sourceArticleId?: string };
    const title = body.title?.trim();
    const text = body.body ? sanitizeDraftHtml(body.body).trim() : "";
    if (!title || title.length > 240 || !text || text.length > 100_000) {
      return Response.json({ error: "A title and content body are required." }, { status: 400 });
    }
    if (body.sourceArticleId) {
      const source = await prisma.article.findFirst({
        where: { id: body.sourceArticleId, organizationId: workspace.organization.id },
        select: { id: true },
      });
      if (!source) return Response.json({ error: "Source article not found." }, { status: 404 });
    }
    const draft = await prisma.contentDraft.create({
      data: {
        organizationId: workspace.organization.id,
        createdById: workspace.userId,
        sourceArticleId: body.sourceArticleId,
        title,
        body: text,
        channel: body.channel === "BLOG" || body.channel === "NEWSLETTER" ? body.channel : "LINKEDIN",
        versions: { create: { version: 1, title, body: text, createdById: workspace.userId } },
        approvals: { create: { actorId: workspace.userId, action: "CREATED" } },
      },
    });
    await prisma.auditEvent.create({
      data: {
        organizationId: workspace.organization.id,
        actorId: workspace.userId,
        action: "CREATED",
        entityType: "ContentDraft",
        entityId: draft.id,
      },
    });
    return Response.json({ draft }, { status: 201 });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
