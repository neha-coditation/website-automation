import { ArticleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

const statuses = new Set(Object.values(ArticleStatus));

export async function GET(request: Request) {
  try {
    const workspace = await requireWorkspace();
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim().slice(0, 120);
    const statusParam = url.searchParams.get("status");
    const status = statusParam && statuses.has(statusParam as ArticleStatus) ? statusParam as ArticleStatus : undefined;
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const where = {
      organizationId: workspace.organization.id,
      ...(status ? { status } : {}),
      ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" as const } }, { description: { contains: query, mode: "insensitive" as const } }] } : {}),
    };
    const [articles, total] = await Promise.all([
      prisma.article.findMany({ where, include: { source: { select: { id: true, name: true } } }, orderBy: { discoveredAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.article.count({ where }),
    ]);
    return Response.json({ articles, total, page, pageSize });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const workspace = await requireWorkspace();
    const body = await request.json() as { articleId?: string; status?: string };
    if (!body.articleId || !body.status || !statuses.has(body.status as ArticleStatus)) {
      return Response.json({ error: "A valid articleId and status are required." }, { status: 400 });
    }
    const result = await prisma.article.updateMany({
      where: { id: body.articleId, organizationId: workspace.organization.id },
      data: { status: body.status as ArticleStatus },
    });
    if (!result.count) return Response.json({ error: "Article not found." }, { status: 404 });
    return Response.json({ updated: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
