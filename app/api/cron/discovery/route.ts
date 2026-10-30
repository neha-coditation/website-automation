import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { syncContentSource } from "@/lib/discovery/sync-source";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || !supplied) return false;
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "Discovery cron is not configured." }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const sources = await prisma.contentSource.findMany({
    where: { status: "ACTIVE", type: { in: ["RSS", "BLOG"] } },
    select: { id: true, organizationId: true },
    take: 50,
    orderBy: { lastFetchedAt: "asc" },
  });
  const results: { sourceId: string; status: string; inserted?: number; updated?: number; error?: string }[] = [];
  for (const source of sources) {
    try {
      const result = await syncContentSource(source.id, source.organizationId);
      results.push({ sourceId: source.id, status: "SYNCED", inserted: result.inserted, updated: result.updated });
    } catch (error) {
      results.push({ sourceId: source.id, status: "FAILED", error: error instanceof Error ? error.message.slice(0, 300) : "Sync failed." });
    }
  }
  return Response.json({ processed: results.length, results });
}
