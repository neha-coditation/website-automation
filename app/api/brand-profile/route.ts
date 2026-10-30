import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";
import { canEditBrandProfile } from "@/lib/workspace-policy";

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    const profile = await prisma.brandProfile.findUnique({
      where: { organizationId: workspace.organization.id },
    });
    return Response.json({ profile });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const workspace = await requireWorkspace();
    if (!canEditBrandProfile(workspace.role)) {
      return Response.json({ error: "You do not have permission to update brand settings." }, { status: 403 });
    }
    const body = await request.json() as Record<string, unknown>;
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (!displayName || displayName.length > 120) {
      return Response.json({ error: "Brand display name is required (maximum 120 characters)." }, { status: 400 });
    }
    const optionalText = (value: unknown, max = 2000) =>
      typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
    const stringArray = (value: unknown) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean).slice(0, 30) : [];
    const profile = await prisma.brandProfile.upsert({
      where: { organizationId: workspace.organization.id },
      create: {
        organizationId: workspace.organization.id,
        displayName,
        websiteUrl: optionalText(body.websiteUrl, 500),
        industry: optionalText(body.industry, 120),
        targetAudience: optionalText(body.targetAudience),
        brandVoice: optionalText(body.brandVoice),
        editorialGuidelines: optionalText(body.editorialGuidelines),
        preferredTopics: stringArray(body.preferredTopics),
        prohibitedTopics: stringArray(body.prohibitedTopics),
      },
      update: {
        displayName,
        websiteUrl: optionalText(body.websiteUrl, 500),
        industry: optionalText(body.industry, 120),
        targetAudience: optionalText(body.targetAudience),
        brandVoice: optionalText(body.brandVoice),
        editorialGuidelines: optionalText(body.editorialGuidelines),
        preferredTopics: stringArray(body.preferredTopics),
        prohibitedTopics: stringArray(body.prohibitedTopics),
      },
    });
    return Response.json({ profile });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
