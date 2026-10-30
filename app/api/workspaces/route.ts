import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const current = await requireWorkspace();
    const memberships = await prisma.membership.findMany({
      where: { userId: current.userId },
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({
      activeOrganizationId: current.organization.id,
      workspaces: memberships.map(item => ({ ...item.organization, role: item.role })),
    });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireWorkspace();
    assertRole(current.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);
    const body = await request.json() as { name?: string };
    const name = body.name?.trim();
    if (!name || name.length > 100) return Response.json({ error: "Workspace name is required (maximum 100 characters)." }, { status: 400 });
    const organization = await prisma.organization.create({
      data: {
        name,
        slug: `ws-${randomUUID().replaceAll("-", "").slice(0, 20)}`,
        memberships: { create: { userId: current.userId, role: OrganizationRole.OWNER } },
      },
    });
    const cookieStore = await cookies();
    cookieStore.set("active-organization-id", organization.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return Response.json({ workspace: { id: organization.id, name: organization.name, slug: organization.slug }, role: OrganizationRole.OWNER }, { status: 201 });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
