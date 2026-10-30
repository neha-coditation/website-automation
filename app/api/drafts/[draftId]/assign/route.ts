import { OrganizationRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertRole, requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type Context = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const workspace = await requireWorkspace();
    assertRole(workspace.role, [OrganizationRole.OWNER, OrganizationRole.ADMIN, OrganizationRole.EDITOR]);
    const { draftId } = await context.params;
    const input = await request.json() as { userId?: string | null };
    if (input.userId) {
      const member = await prisma.membership.findFirst({ where: { organizationId: workspace.organization.id, userId: input.userId }, select: { id: true } });
      if (!member) return Response.json({ error: "Assignee must be a member of this workspace." }, { status: 400 });
    }
    const updated = await prisma.contentDraft.updateMany({
      where: { id: draftId, organizationId: workspace.organization.id },
      data: { assignedToId: input.userId || null },
    });
    if (!updated.count) return Response.json({ error: "Draft not found." }, { status: 404 });
    await prisma.auditEvent.create({ data: { organizationId: workspace.organization.id, actorId: workspace.userId, action: "ASSIGNED", entityType: "ContentDraft", entityId: draftId, metadata: { assignedToId: input.userId || null } } });
    return Response.json({ assigned: true });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
