import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

export async function GET() {
  try {
    const workspace = await requireWorkspace();
    return Response.json({
      workspace: { id: workspace.organization.id, name: workspace.organization.name, slug: workspace.organization.slug },
      role: workspace.role,
      userId: workspace.userId,
    });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
