import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    const accounts = await prisma.socialAccount.findMany({
      where: { organizationId: workspace.organization.id },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        displayName: true,
        profileUrl: true,
        scopes: true,
        tokenExpiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ accounts });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);
    const body = await request.json() as { accountId?: string };
    if (!body.accountId) return Response.json({ error: "accountId is required." }, { status: 400 });
    const result = await prisma.socialAccount.deleteMany({
      where: { id: body.accountId, organizationId: workspace.organization.id },
    });
    if (!result.count) return Response.json({ error: "Connected account not found." }, { status: 404 });
    return Response.json({ disconnected: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
