/**
 * Apple IAP receipt validation endpoint.
 *
 * POST /api/iap/apple
 * Body: { receiptData: string, productId: string, transactionId?: string }
 *
 * Validates the receipt with Apple's verifyReceipt API, then activates
 * premium on the user's account if valid.
 */
import { type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { validateAppleReceipt, activatePremium } from "@/lib/iap-validation";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.userId) {
      return corsJson(request, { success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { receiptData, productId } = body;

    if (!receiptData || !productId) {
      return corsJson(request, { success: false, message: "Missing receiptData or productId" }, { status: 400 });
    }

    // Validate with Apple
    const result = await validateAppleReceipt(receiptData);

    if (!result.valid || !result.originalTransactionId) {
      return corsJson(request, { success: false, message: "Invalid or expired receipt" }, { status: 400 });
    }

    // Activate premium
    await activatePremium(session.userId, "apple", {
      productId: result.productId || productId,
      originalTransactionId: result.originalTransactionId,
      expiresAt: result.expiresAt,
    });

    return corsJson(request, {
      success: true,
      message: "Premium activated",
      tier: "premium",
    });
  } catch (err) {
    console.error("Apple IAP validation error:", err);
    return corsJson(request, { success: false, message: "Internal server error" }, { status: 500 });
  }
}
