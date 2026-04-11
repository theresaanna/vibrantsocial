/**
 * In-App Purchase service for Apple IAP and Google Play Billing.
 *
 * Uses react-native-iap to manage subscriptions. This module requires
 * a dev build (EAS Build) — it will not work in Expo Go.
 *
 * react-native-iap is loaded lazily so the module can be imported on web
 * without crashing the bundler.
 */
import { Platform } from "react-native";
import { api } from "./api";

// Lazy-load react-native-iap only on native platforms to avoid web bundler crash
function getIAP() {
  if (Platform.OS === "web") {
    throw new Error("react-native-iap is not available on web");
  }
  return require("react-native-iap") as typeof import("react-native-iap");
}

type ProductPurchase = import("react-native-iap").ProductPurchase;
type PurchaseError = import("react-native-iap").PurchaseError;
type SubscriptionPurchase = import("react-native-iap").SubscriptionPurchase;
type Subscription = import("react-native-iap").Subscription;

// ── Product IDs ──────────────────────────────────────────────────────
export const PRODUCT_IDS = {
  monthly: "com.vibrantsocial.premium.monthly",
  yearly: "com.vibrantsocial.premium.yearly",
} as const;

const ALL_PRODUCT_IDS = [PRODUCT_IDS.monthly, PRODUCT_IDS.yearly];

// ── Types ────────────────────────────────────────────────────────────
export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  localizedPrice: string;
  price: string;
  currency: string;
}

export interface IAPValidationResult {
  success: boolean;
  message: string;
  tier?: "free" | "premium";
}

// ── State ────────────────────────────────────────────────────────────
let isConnected = false;
let purchaseUpdateSubscription: { remove: () => void } | null = null;
let purchaseErrorSubscription: { remove: () => void } | null = null;

/** Callback invoked when a purchase succeeds and is validated server-side. */
let onPurchaseSuccess: ((result: IAPValidationResult) => void) | null = null;
/** Callback invoked when a purchase fails. */
let onPurchaseError: ((error: string) => void) | null = null;

// ── Connection lifecycle ─────────────────────────────────────────────

/**
 * Initialize IAP connection and set up purchase listeners.
 * Call once at app startup (e.g. in _layout.tsx).
 */
export async function initIAP(): Promise<void> {
  if (Platform.OS === "web") return;
  if (isConnected) return;

  try {
    const iap = getIAP();
    await iap.initConnection();
    isConnected = true;

    // Listen for successful purchases
    purchaseUpdateSubscription = iap.purchaseUpdatedListener(
      async (purchase: ProductPurchase | SubscriptionPurchase) => {
        try {
          const result = await validateReceipt(purchase);

          // Acknowledge/finish the transaction so the store doesn't refund it
          await iap.finishTransaction({ purchase, isConsumable: false });

          onPurchaseSuccess?.(result);
        } catch (err) {
          onPurchaseError?.(
            err instanceof Error ? err.message : "Failed to validate purchase"
          );
        }
      }
    );

    // Listen for purchase errors
    purchaseErrorSubscription = iap.purchaseErrorListener((error: PurchaseError) => {
      // User cancellation is code "E_USER_CANCELLED" — don't treat as error
      if (error.code === "E_USER_CANCELLED") {
        onPurchaseError?.("Purchase cancelled");
        return;
      }
      onPurchaseError?.(error.message || "Purchase failed");
    });
  } catch (err) {
    console.warn("IAP init failed:", err);
    // Non-fatal — user can still use the app without IAP
  }
}

/**
 * End IAP connection and remove listeners. Call on app unmount.
 */
export function endIAP(): void {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
  if (isConnected) {
    getIAP().endConnection();
    isConnected = false;
  }
}

// ── Product fetching ─────────────────────────────────────────────────

/**
 * Fetch subscription products from the store.
 * Returns normalized product info with localized prices.
 */
export async function getProducts(): Promise<IAPProduct[]> {
  if (Platform.OS === "web") return [];

  try {
    const subscriptions: Subscription[] = await getIAP().getSubscriptions({
      skus: ALL_PRODUCT_IDS,
    });

    return subscriptions.map((sub) => ({
      productId: sub.productId,
      title: sub.title || sub.productId,
      description: sub.description || "",
      localizedPrice: sub.localizedPrice || sub.price || "—",
      price: sub.price || "0",
      currency: sub.currency || "USD",
    }));
  } catch (err) {
    console.warn("Failed to fetch IAP products:", err);
    return [];
  }
}

// ── Purchase flow ────────────────────────────────────────────────────

/**
 * Set callbacks for purchase events. Call before initiating a purchase.
 */
export function setPurchaseCallbacks(callbacks: {
  onSuccess?: (result: IAPValidationResult) => void;
  onError?: (error: string) => void;
}): void {
  onPurchaseSuccess = callbacks.onSuccess ?? null;
  onPurchaseError = callbacks.onError ?? null;
}

/**
 * Initiate a subscription purchase.
 * The result will be delivered via the purchase listener callbacks.
 */
export async function purchaseSubscription(productId: string): Promise<void> {
  if (Platform.OS === "web") {
    throw new Error("IAP is not available on web");
  }

  const iap = getIAP();
  if (Platform.OS === "android") {
    await iap.requestSubscription({
      sku: productId,
      subscriptionOffers: [{ sku: productId, offerToken: "" }],
    });
  } else {
    await iap.requestSubscription({ sku: productId });
  }
}

// ── Restore purchases ────────────────────────────────────────────────

/**
 * Restore previous purchases (e.g. after reinstall or new device).
 * Validates each active purchase with the server.
 */
export async function restorePurchases(): Promise<IAPValidationResult> {
  if (Platform.OS === "web") {
    return { success: false, message: "IAP is not available on web" };
  }

  try {
    const purchases = await getIAP().getAvailablePurchases();

    if (purchases.length === 0) {
      return { success: false, message: "No purchases found to restore" };
    }

    // Validate the most recent purchase with the server
    const latest = purchases[purchases.length - 1];
    const result = await validateReceipt(latest);
    return result;
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Failed to restore purchases",
    };
  }
}

// ── Receipt validation ───────────────────────────────────────────────

/**
 * Send a purchase receipt to the server for validation.
 * The server will verify with Apple/Google and update the user's tier.
 */
async function validateReceipt(
  purchase: ProductPurchase | SubscriptionPurchase
): Promise<IAPValidationResult> {
  const platform = Platform.OS as "ios" | "android";

  if (platform === "ios") {
    return api.post<IAPValidationResult>("/api/iap/apple", {
      receiptData: purchase.transactionReceipt,
      productId: purchase.productId,
      transactionId: purchase.transactionId,
    });
  }

  if (platform === "android") {
    return api.post<IAPValidationResult>("/api/iap/google", {
      purchaseToken: purchase.purchaseToken,
      productId: purchase.productId,
      packageName: "com.vibrantsocial.app",
    });
  }

  return { success: false, message: "Unsupported platform" };
}
