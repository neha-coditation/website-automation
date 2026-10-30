import { PublishStatus, ContentStatus, OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type Context = { params: Promise<{ postId: string }> };

export async function DELETE(_request: Request, context: Context) {
  try {
    const workspace = await requireWorkspace();\n    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.EDITOR]);
    const { postId } = await context.params;
    const result = await prisma.$transaction(async tx => {
      const post = await tx.scheduledPost.findFirst({ where: { id: postId, organizationId: workspace.organization.id } });
      if (!post) return { error: "Scheduled post not found.", status: 404 as const };
      if (post.status !== PublishStatus.QUEUED) return { error: "Only queued posts can be cancelled.", status: 409 as const };
      await tx.scheduledPost.update({ where: { id: post.id }, data: { status: PublishStatus.CANCELLED, lockedAt: null } });
      await tx.contentDraft.updateMany({ where: { id: post.draftId, organizationId: workspace.organization.id, status: ContentStatus.SCHEDULED }, data: { status: ContentStatus.APPROVED, scheduledAt: null } });
      await tx.auditEvent.create({ data: { organizationId: workspace.organization.id, actorId: workspace.userId, action: "CANCELLED", entityType: "ScheduledPost", entityId: post.id } });
      return { cancelled: true };
    });
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
