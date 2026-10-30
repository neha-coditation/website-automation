import Parser from "rss-parser";

const MAX_FEED_SIZE = 2 * 1024 * 1024;

const parser = new Parser({
  timeout: 10_000,
  headers: {
    "User-Agent": "MarketingStudio/0.1 (+https://github.com/neha-coditation/website-automation)",
  },
});

export type DiscoveredFeedItem = {
  externalId: string | null;
  canonicalUrl: string;
  title: string;
  description: string | null;
  contentText: string | null;
  author: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
};

export type ParsedFeed = {
  title: string | null;
  description: string | null;
  siteUrl: string | null;
  items: DiscoveredFeedItem[];
};

/**
 * Normalizes an article URL for organization-scoped deduplication.
 * Tracking parameters and fragments are removed; meaningful query params remain.
 */
export function normalizeArticleUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;

    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return null;
  }
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parses RSS 2.0 and Atom XML already fetched by a trusted server-side caller.
 * Network fetching is deliberately separate so URL/SSRF protections can be
 * enforced before any request is made.
 */
export async function parseRssFeedXml(xml: string): Promise<ParsedFeed> {
  if (!xml.trim()) {
    throw new Error("The feed response was empty.");
  }

  if (Buffer.byteLength(xml, "utf8") > MAX_FEED_SIZE) {
    throw new Error("The feed is larger than the 2 MB limit.");
  }

  const feed = await parser.parseString(xml);
  const items: DiscoveredFeedItem[] = [];

  for (const item of feed.items) {
    const rawUrl =
      typeof item.link === "string" && item.link.trim()
        ? item.link
        : typeof item.guid === "string" && /^https?:\/\//i.test(item.guid)
          ? item.guid
          : null;

    const canonicalUrl = rawUrl ? normalizeArticleUrl(rawUrl) : null;
    const title = item.title?.trim();

    if (!canonicalUrl || !title) continue;

    const description =
      item.contentSnippet?.trim() ||
      item.summary?.trim() ||
      null;
    const contentText = item.content?.trim() || null;
    const imageUrl =
      typeof item.enclosure?.url === "string"
        ? normalizeArticleUrl(item.enclosure.url)
        : null;

    items.push({
      externalId:
        typeof item.guid === "string" && item.guid.trim()
          ? item.guid.trim()
          : null,
      canonicalUrl,
      title,
      description,
      contentText,
      author:
        (typeof item.creator === "string" && item.creator.trim()) ||
        (typeof item.author === "string" && item.author.trim()) ||
        null,
      imageUrl,
      publishedAt: parseDate(item.isoDate || item.pubDate),
    });
  }

  return {
    title: feed.title?.trim() || null,
    description: feed.description?.trim() || null,
    siteUrl: feed.link ? normalizeArticleUrl(feed.link) : null,
    items,
  };
}
