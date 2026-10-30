import { cookies } from "next/headers";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const workspace = await requireWorkspace();
    const body = await request.json() as { organizationId?: string };
    if (!body.organizationId) return Response.json({ error: "organizationId is required." }, { status: 400 });
    const membership = await prisma.membership.findFirst({
      where: { userId: workspace.userId, organizationId: body.organizationId },
      select: { organizationId: true },
    });
    if (!membership) return Response.json({ error: "You are not a member of that workspace." }, { status: 403 });
    const cookieStore = await cookies();
    cookieStore.set("active-organization-id", membership.organizationId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return Response.json({ activeOrganizationId: membership.organizationId });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
