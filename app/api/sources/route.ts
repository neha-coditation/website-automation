import { SourceType, OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    const sources = await prisma.contentSource.findMany({
      where: { organizationId: workspace.organization.id },
      include: { _count: { select: { articles: true } } },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ sources });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function PATCH(request: Request) {\n  try {\n    const workspace = await requireWorkspace();\n    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.EDITOR]);\n    const input = await request.json() as { sourceId?: string; status?: string };\n    if (!input.sourceId || !["ACTIVE", "PAUSED"].includes(input.status || "")) return Response.json({ error: "sourceId and ACTIVE/PAUSED status are required." }, { status: 400 });\n    const result = await prisma.contentSource.updateMany({ where: { id: input.sourceId, organizationId: workspace.organization.id }, data: { status: input.status as "ACTIVE" | "PAUSED", lastError: null } });\n    if (!result.count) return Response.json({ error: "Source not found." }, { status: 404 });\n    return Response.json({ updated: true });\n  } catch (error) { return workspaceErrorResponse(error); }\n}\n\nexport async function POST(request: Request) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.EDITOR]);
    const body = await request.json() as { name?: string; url?: string; type?: string };
    const name = body.name?.trim();
    if (!name || name.length > 120 || !body.url || body.url.length > 2048) {
      return Response.json({ error: "A source name and valid URL are required." }, { status: 400 });
    }
    if (body.type !== "RSS" && body.type !== "BLOG") {
      return Response.json({ error: "Only RSS and blog feed sources are supported in this release." }, { status: 400 });
    }
    let url: URL;
    try { url = new URL(body.url); } catch {
      return Response.json({ error: "Enter a valid source URL." }, { status: 400 });
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      return Response.json({ error: "Source URLs must use HTTP or HTTPS and cannot contain credentials." }, { status: 400 });
    }
    const source = await prisma.contentSource.create({
      data: {
        organizationId: workspace.organization.id,
        name,
        url: url.toString(),
        type: body.type as SourceType,
      },
    });
    return Response.json({ source }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json({ error: "This source is already connected to the workspace." }, { status: 409 });
    }
    return workspaceErrorResponse(error);
  }
}
