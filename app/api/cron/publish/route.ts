import { timingSafeEqual } from "node:crypto";
import { ContentStatus, PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { draftHtmlToText } from "@/lib/content/sanitize";
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
  const staleBefore = new Date(now.getTime() - 5 * 60_000);

  // A process that died while a request was in flight may have published remotely.
  // Mark it uncertain and require a human to reconcile before any retry.
  const stale = await prisma.scheduledPost.findMany({
    where: { status: PublishStatus.PUBLISHING, lockedAt: { lt: staleBefore } },
    select: { id: true, organizationId: true, draftId: true, attemptCount: true },
    take: 20,
  });
  for (const item of stale) {
    const marked = await prisma.scheduledPost.updateMany({
      where: { id: item.id, status: PublishStatus.PUBLISHING, lockedAt: { lt: staleBefore } },
      data: {
        status: PublishStatus.FAILED,
        lockedAt: null,
        outcomeUncertain: true,
        lastError: "The publishing worker stopped during the request. Verify LinkedIn before retrying.",
      },
    });
    if (marked.count) {
      await prisma.$transaction(async tx => {
        await tx.publishAttempt.create({
          data: {
            scheduledPostId: item.id,
            attemptNumber: item.attemptCount,
            status: PublishStatus.FAILED,
            errorMessage: "Worker stopped while the remote publish outcome was unknown.",
            finishedAt: new Date(),
          },
        });
        await tx.contentDraft.update({ where: { id: item.draftId }, data: { status: ContentStatus.FAILED } });
        await tx.auditEvent.create({
          data: {
            organizationId: item.organizationId,
            action: "PUBLISH_FAILED",
            entityType: "ScheduledPost",
            entityId: item.id,
            metadata: { outcomeUncertain: true, attemptNumber: item.attemptCount },
          },
        });
      });
    }
  }

  const due = await prisma.scheduledPost.findMany({
    where: {
      status: PublishStatus.QUEUED,
      scheduledAt: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
    },
    select: { id: true },
    orderBy: { scheduledAt: "asc" },
    take: 2,
  });

  const results: { id: string; status: string; detail?: string }[] = [];
  for (const candidate of due) {
    const claimed = await prisma.scheduledPost.updateMany({
      where: {
        id: candidate.id,
        status: PublishStatus.QUEUED,
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
      },
      data: {
        status: PublishStatus.PUBLISHING,
        lockedAt: now,
        attemptCount: { increment: 1 },
      },
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
    let providerAccepted = false;

    try {
      if (post.draft.status !== ContentStatus.SCHEDULED || post.draft.approvals.length === 0) {
        throw new Error("Publishing blocked: the draft is not scheduled with a recorded human approval.");
      }
      if (post.socialAccount.tokenExpiresAt && post.socialAccount.tokenExpiresAt <= now) {
        throw new Error("LinkedIn access token expired; reconnect the account.");
      }
      const token = decryptSecret(post.socialAccount.encryptedAccessToken);
      const published = await publishLinkedInPost(
        token,
        post.socialAccount.providerAccountId,
        draftHtmlToText(post.draft.body),
      );
      providerAccepted = true;

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
          data: {
            status: PublishStatus.PUBLISHED,
            externalPostId: published.externalPostId,
            publishedAt: new Date(),
            lockedAt: null,
            lastError: null,
            outcomeUncertain: false,
          },
        });
        await tx.contentDraft.update({ where: { id: post.draftId }, data: { status: ContentStatus.PUBLISHED } });
        await tx.auditEvent.create({
          data: {
            organizationId: post.organizationId,
            action: "PUBLISHED",
            entityType: "ScheduledPost",
            entityId: post.id,
            metadata: { externalPostId: published.externalPostId },
          },
        });
      });
      results.push({ id: post.id, status: "PUBLISHED" });
    } catch (error) {
      const message = providerAccepted
        ? "LinkedIn accepted the post, but local status persistence failed. Verify LinkedIn before retrying."
        : error instanceof Error ? error.message.slice(0, 1000) : "Unknown publishing failure.";
      const uncertain = providerAccepted || (error instanceof LinkedInPublishError && error.outcomeUncertain);
      const retryable = !uncertain && error instanceof LinkedInPublishError && error.retryable && attemptNumber < 3;
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
            outcomeUncertain: uncertain,
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
            metadata: { attemptNumber, retryable, outcomeUncertain: uncertain, error: message },
          },
        });
      });
      results.push({
        id: post.id,
        status: retryable ? "RETRY_QUEUED" : "FAILED",
        detail: message,
      });
    }
  }

  return Response.json({ processed: results.length, results });
}
