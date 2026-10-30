import { ContentStatus, PublishStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    const organizationId = workspace.organization.id;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [articleCount, draftCount, reviewCount, publishedCount, recentDrafts, recentArticles, sources] = await Promise.all([
      prisma.article.count({ where: { organizationId, status: { not: "DISMISSED" } } }),
      prisma.contentDraft.count({ where: { organizationId, status: { in: [ContentStatus.DRAFT, ContentStatus.CHANGES_REQUESTED, ContentStatus.IN_REVIEW] } } }),
      prisma.contentDraft.count({ where: { organizationId, status: ContentStatus.IN_REVIEW } }),
      prisma.scheduledPost.count({ where: { organizationId, status: PublishStatus.PUBLISHED, publishedAt: { gte: monthStart } } }),
      prisma.contentDraft.findMany({
        where: { organizationId },
        include: { createdBy: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
      prisma.article.findMany({
        where: { organizationId, status: { not: "DISMISSED" } },
        include: { source: { select: { name: true } } },
        orderBy: { discoveredAt: "desc" },
        take: 4,
      }),
      prisma.contentSource.findMany({
        where: { organizationId },
        include: { _count: { select: { articles: true } } },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }),
    ]);
    return Response.json({
      workspace: { id: workspace.organization.id, name: workspace.organization.name, role: workspace.role },
      metrics: { articleCount, draftCount, reviewCount, publishedCount },
      recentDrafts: recentDrafts.map(draft => ({
        id: draft.id,
        title: draft.title,
        channel: draft.channel,
        status: draft.status,
        owner: draft.createdBy.name || "Workspace member",
        updatedAt: draft.updatedAt,
      })),
      recentArticles: recentArticles.map(article => ({
        id: article.id,
        title: article.title,
        source: article.source?.name || "Manual source",
        publishedAt: article.publishedAt,
      })),
      sources: sources.map(source => ({ id: source.id, name: source.name, type: source.type, articles: source._count.articles, status: source.status })),
    });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
