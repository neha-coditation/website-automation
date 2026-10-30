import { timingSafeEqual } from "node:crypto";
import { ContentStatus, PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { LinkedInPublishError, publishLinkedInPost } from "@/lib/social/linkedin";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || !supplied) return false;
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "Publishing worker is not configured." }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const now = new Date();
  const due = await prisma.scheduledPost.findMany({
    where: {
      status: PublishStatus.QUEUED,
      scheduledAt: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } }],
    },
    select: { id: true },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });

  const results: { id: string; status: string; detail?: string }[] = [];
  for (const candidate of due) {
    const claimed = await prisma.scheduledPost.updateMany({
      where: {
        id: candidate.id,
        status: PublishStatus.QUEUED,
        OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } }],
      },
      data: { status: PublishStatus.PUBLISHING, lockedAt: now, attemptCount: { increment: 1 } },
    });
    if (!claimed.count) continue;

    const post = await prisma.scheduledPost.findUnique({
      where: { id: candidate.id },
      include: {
        draft: { include: { approvals: { where: { action: "APPROVED" }, take: 1 } } },
        socialAccount: true,
      },
    });
    if (!post) continue;
    const attemptNumber = post.attemptCount;
    const startedAt = new Date();

    try {
      if (post.draft.status !== ContentStatus.SCHEDULED || post.draft.approvals.length === 0) {
        throw new Error("Publishing blocked: the draft is not scheduled with a recorded human approval.");
      }
      if (post.socialAccount.tokenExpiresAt && post.socialAccount.tokenExpiresAt <= now) {
        throw new Error("LinkedIn access token expired; reconnect the account.");
      }
      const token = decryptSecret(post.socialAccount.encryptedAccessToken);
      const published = await publishLinkedInPost(token, post.socialAccount.providerAccountId, post.draft.body);
      await prisma.$transaction(async tx => {
        await tx.publishAttempt.create({
          data: {
            scheduledPostId: post.id,
            attemptNumber,
            status: PublishStatus.PUBLISHED,
            responseCode: 201,
            responseBody: published.responseBody,
            startedAt,
            finishedAt: new Date(),
          },
        });
        await tx.scheduledPost.update({
          where: { id: post.id },
          data: { status: PublishStatus.PUBLISHED, externalPostId: published.externalPostId, publishedAt: new Date(), lockedAt: null, lastError: null },
        });
        await tx.contentDraft.update({ where: { id: post.draftId }, data: { status: ContentStatus.PUBLISHED } });
        await tx.auditEvent.create({
          data: { organizationId: post.organizationId, action: "PUBLISHED", entityType: "ScheduledPost", entityId: post.id, metadata: { externalPostId: published.externalPostId } },
        });
      });
      results.push({ id: post.id, status: "PUBLISHED" });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : "Unknown publishing failure.";
      const retryable = error instanceof LinkedInPublishError && error.retryable && attemptNumber < 3;
      const retryAt = new Date(Date.now() + Math.min(15, 2 ** attemptNumber) * 60_000);
      await prisma.$transaction(async tx => {
        await tx.publishAttempt.create({
          data: {
            scheduledPostId: post.id,
            attemptNumber,
            status: PublishStatus.FAILED,
            responseCode: error instanceof LinkedInPublishError ? error.statusCode : null,
            errorMessage: message,
            startedAt,
            finishedAt: new Date(),
          },
        });
        await tx.scheduledPost.update({
          where: { id: post.id },
          data: {
            status: retryable ? PublishStatus.QUEUED : PublishStatus.FAILED,
            scheduledAt: retryable ? retryAt : post.scheduledAt,
            lockedAt: null,
            lastError: message,
          },
        });
        if (!retryable) {
          await tx.contentDraft.update({ where: { id: post.draftId }, data: { status: ContentStatus.FAILED } });
        }
        await tx.auditEvent.create({
          data: {
            organizationId: post.organizationId,
            action: retryable ? "SCHEDULED" : "PUBLISH_FAILED",
            entityType: "ScheduledPost",
            entityId: post.id,
            metadata: { attemptNumber, retryable, error: message },
          },
        });
      });
      results.push({ id: post.id, status: retryable ? "RETRY_QUEUED" : "FAILED", detail: message });
    }
  }

  return Response.json({ processed: results.length, results });
}
