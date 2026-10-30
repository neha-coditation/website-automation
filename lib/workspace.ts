import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { OrganizationRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class WorkspaceAccessError extends Error {
  constructor(message: string, public status = 403) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

export async function requireWorkspace() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) throw new WorkspaceAccessError("Sign in is required.", 401);

  const cookieStore = await cookies();
  const requestedOrganizationId = cookieStore.get("active-organization-id")?.value;

  let membership = requestedOrganizationId
    ? await prisma.membership.findFirst({
        where: { userId, organizationId: requestedOrganizationId },
        include: { organization: true },
      })
    : null;

  if (!membership) {
    membership = await prisma.membership.findFirst({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
  }

  if (!membership) {
    const baseName = session.user.name?.trim() || "My workspace";
    const slug = `workspace-${userId.slice(-10).toLowerCase()}`;
    membership = await prisma.membership.create({
      data: {
        role: OrganizationRole.OWNER,
        user: { connect: { id: userId } },
        organization: {
          create: {
            name: baseName + "'s workspace",
            slug,
          },
        },
      },
      include: { organization: true },
    });
  }

  return {
    userId,
    role: membership.role,
    organization: membership.organization,
  };
}

export function assertRole(
  role: OrganizationRole,
  allowed: OrganizationRole[],
) {
  if (!allowed.includes(role)) {
    throw new WorkspaceAccessError("You do not have permission to perform this action.", 403);
  }
}

export function workspaceErrorResponse(error: unknown) {
  if (error instanceof WorkspaceAccessError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "An unexpected server error occurred." }, { status: 500 });
}
