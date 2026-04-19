/**
 * Delete a user's custom theme preset.
 *
 * DELETE /api/v1/theme/presets/:id
 *
 * Scoped to the viewer — you can't delete someone else's preset even
 * if you know its id.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const { id } = await params;

  await prisma.customThemePreset.deleteMany({
    where: { id, userId: viewer.userId },
  });
  return corsJson(req, { ok: true });
}
