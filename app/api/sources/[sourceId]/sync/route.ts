import { OrganizationRole } from "@prisma/client";
import { syncContentSource } from "@/lib/discovery/sync-source";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type Context = { params: Promise<{ sourceId: string }> };

export async function POST(_request: Request, context: Context) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.EDITOR]);
    const { sourceId } = await context.params;
    const result = await syncContentSource(sourceId, workspace.organization.id);
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Source not found or paused.") {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return workspaceErrorResponse(error);
  }
}
