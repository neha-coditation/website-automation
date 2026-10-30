import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import { assertRole, requireWorkspace } from "@/lib/workspace";

type LinkedInToken = { access_token: string; expires_in: number; scope?: string };
type LinkedInProfile = { sub: string; name?: string; picture?: string };

function resultRedirect(status: string) {
  return NextResponse.redirect(new URL(`/?linkedin=${status}`, process.env.NEXTAUTH_URL || "http://localhost:3000"));
}

export async function GET(request: Request) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (url.searchParams.has("error") || !code || !state) return resultRedirect("cancelled");

    const stateHash = createHash("sha256").update(state).digest("hex");
    const savedState = await prisma.socialOAuthState.findFirst({
      where: {
        stateHash,
        organizationId: workspace.organization.id,
        userId: workspace.userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!savedState) return resultRedirect("invalid-state");
    const claimed = await prisma.socialOAuthState.updateMany({
      where: { id: savedState.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (!claimed.count) return resultRedirect("invalid-state");

    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) return resultRedirect("not-configured");

    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!tokenResponse.ok) {
      console.error("LinkedIn token exchange failed", tokenResponse.status, (await tokenResponse.text()).slice(0, 300));
      return resultRedirect("token-error");
    }
    const token = await tokenResponse.json() as LinkedInToken;
    if (!token.access_token || !Number.isFinite(token.expires_in)) return resultRedirect("token-error");
    const grantedScopes = (token.scope || "").split(/[ ,]+/).filter(Boolean);
    if (!grantedScopes.includes("w_member_social")) return resultRedirect("missing-permission");

    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!profileResponse.ok) {
      console.error("LinkedIn profile lookup failed", profileResponse.status);
      return resultRedirect("profile-error");
    }
    const profile = await profileResponse.json() as LinkedInProfile;
    if (!profile.sub) return resultRedirect("profile-error");

    await prisma.socialAccount.upsert({
      where: {
        organizationId_provider_providerAccountId: {
          organizationId: workspace.organization.id,
          provider: "LINKEDIN",
          providerAccountId: profile.sub,
        },
      },
      create: {
        organizationId: workspace.organization.id,
        provider: "LINKEDIN",
        providerAccountId: profile.sub,
        displayName: profile.name || "LinkedIn member",
        profileUrl: profile.picture || null,
        encryptedAccessToken: encryptSecret(token.access_token),
        isActive: true,
        disconnectedAt: null,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
        scopes: grantedScopes,
        connectedById: workspace.userId,
      },
      update: {
        displayName: profile.name || "LinkedIn member",
        profileUrl: profile.picture || null,
        encryptedAccessToken: encryptSecret(token.access_token),
        isActive: true,
        disconnectedAt: null,
        tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000),
        scopes: grantedScopes,
      },
    });
    return resultRedirect("connected");
  } catch (error) {
    console.error("LinkedIn OAuth callback failed", error instanceof Error ? error.message : "unknown error");
    return resultRedirect("error");
  }
}
