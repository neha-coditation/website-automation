import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return Response.json({ error: "LinkedIn OAuth is not configured on the server." }, { status: 503 });
    }
    const state = randomBytes(32).toString("hex");
    const stateHash = createHash("sha256").update(state).digest("hex");
    await prisma.socialOAuthState.create({
      data: {
        stateHash,
        organizationId: workspace.organization.id,
        userId: workspace.userId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    const authorizationUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", redirectUri);
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("scope", "openid profile w_member_social");
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
