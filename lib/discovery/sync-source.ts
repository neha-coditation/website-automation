import { SourceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchRssFeed } from "@/lib/discovery/fetch-rss-feed";
import { parseRssFeedXml } from "@/lib/discovery/parse-rss-feed";

export async function syncContentSource(sourceId: string, organizationId: string) {
  const source = await prisma.contentSource.findFirst({
    where: { id: sourceId, organizationId, status: { not: "PAUSED" } },
  });
  if (!source) throw new Error("Source not found or paused.");
  try {
    await prisma.contentSource.update({
      where: { id: source.id },
      data: { lastAttemptAt: new Date() },
    });
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
          organizationId, sourceId: source.id, externalId: item.externalId,
          canonicalUrl: item.canonicalUrl, title: item.title, description: item.description,
          contentText: item.contentText, author: item.author, imageUrl: item.imageUrl,
          publishedAt: item.publishedAt,
        },
        update: {
          sourceId: source.id, title: item.title, description: item.description,
          contentText: item.contentText, author: item.author, imageUrl: item.imageUrl,
          publishedAt: item.publishedAt,
        },
      });
      if (existing) updated += 1; else inserted += 1;
    }
    await prisma.contentSource.update({
      where: { id: source.id },
      data: { lastFetchedAt: new Date(), lastAttemptAt: new Date(), lastError: null, status: SourceStatus.ACTIVE },
    });
    return { sourceId: source.id, feedTitle: feed.title, fetched: feed.items.length, inserted, updated };
  } catch (error) {
    await prisma.contentSource.update({
      where: { id: source.id },
      data: { lastAttemptAt: new Date(), status: SourceStatus.ERROR, lastError: error instanceof Error ? error.message.slice(0, 500) : "Feed sync failed." },
    });
    throw error;
  }
}
