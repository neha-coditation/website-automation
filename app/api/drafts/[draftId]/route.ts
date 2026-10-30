import { ContentStatus, OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeDraftHtml } from "@/lib/content/sanitize";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type Context = { params: Promise<{ draftId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.EDITOR]);
    const { draftId } = await context.params;
    const input = await request.json() as { title?: string; body?: string; expectedVersion?: number };
    const title = input.title?.trim();
    const body = input.body ? sanitizeDraftHtml(input.body).trim() : "";
    if (!title || title.length > 240 || !body || body.length > 100_000 || !Number.isInteger(input.expectedVersion)) {
      return Response.json({ error: "Valid title, body and expectedVersion are required." }, { status: 400 });
    }
    const result = await prisma.$transaction(async tx => {
      const current = await tx.contentDraft.findFirst({
        where: { id: draftId, organizationId: workspace.organization.id },
      });
      if (!current) return { error: "Draft not found.", status: 404 as const };
      if (![ContentStatus.DRAFT, ContentStatus.CHANGES_REQUESTED].includes(current.status)) {
        return { error: "Only drafts and drafts with requested changes can be edited.", status: 409 as const };
      }
      if (current.currentVersion !== input.expectedVersion) {
        return { error: "This draft has changed since you opened it. Reload before editing.", status: 409 as const };
      }
      const nextVersion = current.currentVersion + 1;
      const updated = await tx.contentDraft.updateMany({
        where: { id: draftId, organizationId: workspace.organization.id, currentVersion: input.expectedVersion },
        data: { title, body, currentVersion: nextVersion },
      });
      if (!updated.count) return { error: "Draft version conflict. Reload before editing.", status: 409 as const };
      await tx.draftVersion.create({
        data: { draftId, version: nextVersion, title, body, createdById: workspace.userId },
      });
      await tx.auditEvent.create({
        data: { organizationId: workspace.organization.id, actorId: workspace.userId, action: "UPDATED", entityType: "ContentDraft", entityId: draftId, metadata: { version: nextVersion } },
      });
      return { draft: await tx.contentDraft.findUnique({ where: { id: draftId } }) };
    });
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
