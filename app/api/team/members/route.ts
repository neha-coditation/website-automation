import { prisma } from "@/lib/prisma";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    const memberships = await prisma.membership.findMany({
      where: { organizationId: workspace.organization.id },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json({
      members: memberships.map(item => ({ ...item.user, role: item.role })),
    });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
