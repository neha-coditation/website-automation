import { prisma } from "@/lib/prisma";
import { requireWorkspace, workspaceErrorResponse } from "@/lib/workspace";

type Context = { params: Promise<{ draftId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const workspace = await requireWorkspace();
    const { draftId } = await context.params;
    const draft = await prisma.contentDraft.findFirst({
      where: { id: draftId, organizationId: workspace.organization.id },
      select: { id: true, title: true, body: true, status: true, currentVersion: true },
    });
    if (!draft) return Response.json({ error: "Draft not found." }, { status: 404 });
    const versions = await prisma.draftVersion.findMany({
      where: { draftId },
      orderBy: { version: "desc" },
    });
    return Response.json({ draft, versions });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
