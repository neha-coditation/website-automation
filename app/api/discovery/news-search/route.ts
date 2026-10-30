import { OrganizationRole } from "@prisma/client";\nimport { prisma } from "@/lib/prisma";
import { normalizeArticleUrl } from "@/lib/discovery/parse-rss-feed";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type NewsApiArticle = {
  title?: string | null;
  description?: string | null;
  content?: string | null;
  url?: string;
  urlToImage?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  source?: { name?: string };
};

export async function POST(request: Request) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.EDITOR]);\n    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) return Response.json({ error: "News search is not configured. Add NEWS_API_KEY on the server." }, { status: 503 });
    const incoming = new URL(request.url);
    const query = incoming.searchParams.get("q")?.trim().slice(0, 200);
    if (!query || query.length < 2) return Response.json({ error: "Enter a search query with at least 2 characters." }, { status: 400 });
    const params = new URLSearchParams({ q: query, language: "en", sortBy: "publishedAt", pageSize: "20" });
    const response = await fetch(`https://newsapi.org/v2/everything?${params}`, { headers: { "X-Api-Key": apiKey }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      console.error("News API request failed", response.status, (await response.text()).slice(0, 300));
      return Response.json({ error: "News provider search failed. Check the API plan and key." }, { status: 502 });
    }
    const payload = await response.json() as { status: string; articles?: NewsApiArticle[] };
    if (payload.status !== "ok") return Response.json({ error: "News provider returned an unsuccessful response." }, { status: 502 });
    const source = await prisma.contentSource.upsert({
      where: { organizationId_url: { organizationId: workspace.organization.id, url: "https://newsapi.org/v2/everything" } },
      create: { organizationId: workspace.organization.id, name: "NewsAPI search", url: "https://newsapi.org/v2/everything", type: "NEWS_API" },
      update: { lastFetchedAt: new Date(), lastError: null },
    });
    let saved = 0;
    for (const item of payload.articles || []) {
      if (!item.title || !item.url) continue;
      const canonicalUrl = normalizeArticleUrl(item.url);
      if (!canonicalUrl) continue;
      await prisma.article.upsert({
        where: { organizationId_canonicalUrl: { organizationId: workspace.organization.id, canonicalUrl } },
        create: {
          organizationId: workspace.organization.id,
          sourceId: source.id,
          canonicalUrl,
          title: item.title.slice(0, 500),
          description: item.description?.slice(0, 5000) || null,
          contentText: item.content?.slice(0, 12000) || null,
          author: item.author?.slice(0, 200) || item.source?.name || null,
          imageUrl: item.urlToImage ? normalizeArticleUrl(item.urlToImage) : null,
          publishedAt: item.publishedAt && !Number.isNaN(Date.parse(item.publishedAt)) ? new Date(item.publishedAt) : null,
        },
        update: {
          title: item.title.slice(0, 500),
          description: item.description?.slice(0, 5000) || null,
          contentText: item.content?.slice(0, 12000) || null,
        },
      });
      saved += 1;
    }
    return Response.json({ query, returned: payload.articles?.length || 0, saved });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
