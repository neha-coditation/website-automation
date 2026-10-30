import { ContentStatus, OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type Context = { params: Promise<{ draftId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.EDITOR]);
    const { draftId } = await context.params;
    const result = await prisma.$transaction(async tx => {
      const draft = await tx.contentDraft.findFirst({ where: { id: draftId, organizationId: workspace.organization.id } });
      if (!draft) return { error: "Draft not found.", status: 404 as const };
      if (![ContentStatus.DRAFT, ContentStatus.CHANGES_REQUESTED].includes(draft.status)) {
        return { error: "Only editable drafts can be submitted for review.", status: 409 as const };
      }
      await tx.contentDraft.update({ where: { id: draftId }, data: { status: ContentStatus.IN_REVIEW } });
      await tx.approvalEvent.create({ data: { draftId, actorId: workspace.userId, action: "SUBMITTED_FOR_REVIEW" } });
      await tx.auditEvent.create({ data: { organizationId: workspace.organization.id, actorId: workspace.userId, action: "SUBMITTED_FOR_REVIEW", entityType: "ContentDraft", entityId: draftId } });
      return { submitted: true };
    });
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
