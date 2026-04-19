/**
 * Sparklefall click-to-earn-star reward claim.
 *
 * POST /api/v1/sparkle/reward
 *   → 200 { awarded: 1, total: <new stars> }
 *   → 429 { error: "rate_limited" }       — daily cap (10/day) hit
 *
 * The Flutter sparkle widget calls this once per successful tap. The
 * rate limiter silently enforces the cap; callers should treat a 429
 * as a signal to stop showing "earn star" feedback for the rest of the
 * session.
 */
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { claimSparkleRewardForUser } from "@/app/profile/sparkle-reward-actions";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const result = await claimSparkleRewardForUser(viewer.userId);
  if (!result.ok) {
    return corsJson(req, { error: result.error }, { status: 429 });
  }
  return corsJson(req, { awarded: result.awarded, total: result.total });
}
