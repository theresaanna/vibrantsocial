/**
 * Google Play Billing receipt validation endpoint.
 *
 * POST /api/iap/google
 * Body: { purchaseToken: string, productId: string, packageName?: string }
 *
 * Validates the purchase with Google Play Developer API, then activates
 * premium on the user's account if valid.
 */
import { type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { validateGooglePurchase, activatePremium } from "@/lib/iap-validation";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.user?.id) {
      return corsJson(request, { success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { purchaseToken, productId } = body;

    if (!purchaseToken || !productId) {
      return corsJson(request, { success: false, message: "Missing purchaseToken or productId" }, { status: 400 });
    }

    // Validate with Google
    const result = await validateGooglePurchase(purchaseToken, productId);

    if (!result.valid) {
      return corsJson(request, { success: false, message: "Invalid or expired purchase" }, { status: 400 });
    }

    // Activate premium
    await activatePremium(session.user.id, "google", {
      productId,
      purchaseToken,
      expiresAt: result.expiresAt,
    });

    return corsJson(request, {
      success: true,
      message: "Premium activated",
      tier: "premium",
    });
  } catch (err) {
    console.error("Google Play validation error:", err);
    return corsJson(request, { success: false, message: "Internal server error" }, { status: 500 });
  }
}
