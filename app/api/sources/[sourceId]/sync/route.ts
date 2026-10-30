import { SourceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchRssFeed } from "@/lib/discovery/fetch-rss-feed";
import { parseRssFeedXml } from "@/lib/discovery/parse-rss-feed";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type Context = { params: Promise<{ sourceId: string }> };

export async function POST(_request: Request, context: Context) {
  let sourceId = "";
  let organizationId = "";
  try {
    const workspace = await requireWorkspace();
    organizationId = workspace.organization.id;
    sourceId = (await context.params).sourceId;
    const source = await prisma.contentSource.findFirst({
      where: { id: sourceId, organizationId, status: { not: "PAUSED" } },
    });
    if (!source) return Response.json({ error: "Source not found or paused." }, { status: 404 });

    const fetched = await fetchRssFeed(source.url);
    const feed = await parseRssFeedXml(fetched.xml);
    let inserted = 0;
    let updated = 0;

    for (const item of feed.items) {
      const existing = await prisma.article.findUnique({
        where: { organizationId_canonicalUrl: { organizationId, canonicalUrl: item.canonicalUrl } },
        select: { id: true },
      });
      await prisma.article.upsert({
        where: { organizationId_canonicalUrl: { organizationId, canonicalUrl: item.canonicalUrl } },
        create: {
          organizationId,
          sourceId: source.id,
          externalId: item.externalId,
          canonicalUrl: item.canonicalUrl,
          title: item.title,
          description: item.description,
          contentText: item.contentText,
          author: item.author,
          imageUrl: item.imageUrl,
          publishedAt: item.publishedAt,
        },
        update: {
          sourceId: source.id,
          title: item.title,
          description: item.description,
          contentText: item.contentText,
          author: item.author,
          imageUrl: item.imageUrl,
          publishedAt: item.publishedAt,
        },
      });
      if (existing) updated += 1; else inserted += 1;
    }

    await prisma.contentSource.update({
      where: { id: source.id },
      data: { lastFetchedAt: new Date(), lastError: null, status: SourceStatus.ACTIVE },
    });
    return Response.json({
      sourceId: source.id,
      feedTitle: feed.title,
      fetched: feed.items.length,
      inserted,
      updated,
      skipped: 0,
    });
  } catch (error) {
    if (sourceId && organizationId) {
      await prisma.contentSource.updateMany({
        where: { id: sourceId, organizationId },
        data: { status: SourceStatus.ERROR, lastError: error instanceof Error ? error.message.slice(0, 500) : "Feed sync failed." },
      }).catch(() => undefined);
    }
    return workspaceErrorResponse(error);
  }
}
