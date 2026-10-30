import { createHash, randomBytes } from "node:crypto";
import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);
    const invitations = await prisma.organizationInvitation.findMany({
      where: { organizationId: workspace.organization.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true, invitedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ invitations });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);
    const body = await request.json() as { email?: string; role?: string };
    const email = body.email?.trim().toLowerCase();
    const role = body.role as OrganizationRole;
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (![OrganizationRole.ADMIN, OrganizationRole.EDITOR, OrganizationRole.REVIEWER, OrganizationRole.VIEWER].includes(role)) {
      return Response.json({ error: "Choose an allowed team role." }, { status: 400 });
    }
    if (workspace.role === OrganizationRole.ADMIN && role === OrganizationRole.ADMIN) {
      return Response.json({ error: "Only workspace owners can invite another admin." }, { status: 403 });
    }
    const existing = await prisma.membership.findFirst({
      where: { organizationId: workspace.organization.id, user: { email } },
      select: { id: true },
    });
    if (existing) return Response.json({ error: "That user is already a workspace member." }, { status: 409 });
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const invitation = await prisma.organizationInvitation.create({
      data: {
        organizationId: workspace.organization.id,
        email,
        role,
        tokenHash,
        invitedById: workspace.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { id: true, email: true, role: true, expiresAt: true },
    });
    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
    return Response.json({ invitation, inviteUrl: `${baseUrl}/invite/${token}` }, { status: 201 });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
