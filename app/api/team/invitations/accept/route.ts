import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return Response.json({ error: "Sign in before accepting an invitation." }, { status: 401 });
  const body = await request.json() as { token?: string };
  if (!body.token || body.token.length > 200) return Response.json({ error: "A valid invitation token is required." }, { status: 400 });
  const tokenHash = createHash("sha256").update(body.token).digest("hex");
  const invitation = await prisma.organizationInvitation.findFirst({
    where: { tokenHash, email: session.user.email.toLowerCase(), acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!invitation) return Response.json({ error: "Invitation is invalid, expired, already used, or belongs to another email address." }, { status: 404 });
  const result = await prisma.$transaction(async tx => {
    const claimed = await tx.organizationInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (!claimed.count) return false;
    await tx.membership.upsert({
      where: { organizationId_userId: { organizationId: invitation.organizationId, userId: session.user.id } },
      create: { organizationId: invitation.organizationId, userId: session.user.id, role: invitation.role },
      update: { role: invitation.role },
    });
    return true;
  });
  if (!result) return Response.json({ error: "This invitation has already been used." }, { status: 409 });
  const cookieStore = await cookies();
  cookieStore.set("active-organization-id", invitation.organizationId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return Response.json({ accepted: true, organizationId: invitation.organizationId });
}
