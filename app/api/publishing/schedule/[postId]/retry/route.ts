import { PublishStatus, ContentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type Context = { params: Promise<{ postId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const workspace = await requireWorkspace();
    const { postId } = await context.params;
    const result = await prisma.$transaction(async tx => {
      const post = await tx.scheduledPost.findFirst({
        where: { id: postId, organizationId: workspace.organization.id },
        include: { draft: true, socialAccount: true },
      });
      if (!post) return { error: "Scheduled post not found.", status: 404 as const };
      if (post.status !== PublishStatus.FAILED) return { error: "Only failed posts can be retried.", status: 409 as const };
      const approval = await tx.approvalEvent.findFirst({ where: { draftId: post.draftId, action: "APPROVED" }, select: { id: true } });
      if (!approval) return { error: "The draft no longer has an approval record.", status: 409 as const };
      if (post.socialAccount.tokenExpiresAt && post.socialAccount.tokenExpiresAt <= new Date()) {
        return { error: "Reconnect the LinkedIn account before retrying.", status: 409 as const };
      }
      await tx.scheduledPost.update({ where: { id: post.id }, data: { status: PublishStatus.QUEUED, scheduledAt: new Date(Date.now() + 60_000), lockedAt: null, lastError: null } });
      await tx.contentDraft.update({ where: { id: post.draftId }, data: { status: ContentStatus.SCHEDULED } });
      await tx.auditEvent.create({ data: { organizationId: workspace.organization.id, actorId: workspace.userId, action: "SCHEDULED", entityType: "ScheduledPost", entityId: post.id, metadata: { manualRetry: true } } });
      return { queued: true };
    });
    if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
