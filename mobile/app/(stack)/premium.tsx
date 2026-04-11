import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import {
  getProducts,
  purchaseSubscription,
  restorePurchases,
  setPurchaseCallbacks,
  type IAPProduct,
  type IAPValidationResult,
} from "@/lib/iap";

const FEATURES = [
  {
    title: "Custom Profile Themes",
    description: "Choose your own colors for text, links, backgrounds, and containers.",
  },
  {
    title: "Profile Picture Frames",
    description: "Add eye-catching frames to your profile picture with a variety of styles.",
  },
  {
    title: "Custom Backgrounds",
    description: "Upload your own background image for your profile page.",
  },
  {
    title: "Custom Audience",
    description: "Control exactly who sees your posts with custom audience lists.",
  },
  {
    title: "Free Age Verification",
    description: "Get a free age verification coupon so you can verify your account instantly.",
  },
  {
    title: "Higher Upload Limits",
    description: "Upload images up to 20MB, videos up to 200MB, and 2-minute voice notes.",
  },
];

const FREE_LIMITS = [
  "5 MB images",
  "50 MB videos",
  "20 sec voice notes",
  "Basic profile",
];

const PREMIUM_LIMITS = [
  "20 MB images",
  "200 MB videos",
  "2 min voice notes",
  "Custom themes & frames",
  "Custom backgrounds",
  "Custom audiences",
];

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export default function PremiumScreen() {
  const { user, refreshUser } = useAuth();
  const isPremium = user?.tier === "premium";
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(isNative);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch IAP products on mount (native only)
  useEffect(() => {
    if (!isNative) return;

    let cancelled = false;
    (async () => {
      try {
        const items = await getProducts();
        if (!cancelled) setProducts(items);
      } catch {
        // Products may not be available in dev builds without store config
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Set up purchase callbacks
  useEffect(() => {
    if (!isNative) return;

    setPurchaseCallbacks({
      onSuccess: (result: IAPValidationResult) => {
        setPurchasing(false);
        if (result.success) {
          setSuccessMessage("Welcome to Premium!");
          setError(null);
          refreshUser();
        } else {
          setError(result.message || "Purchase validation failed");
        }
      },
      onError: (errorMsg: string) => {
        setPurchasing(false);
        if (errorMsg !== "Purchase cancelled") {
          setError(errorMsg);
        }
      },
    });

    return () => {
      setPurchaseCallbacks({});
    };
  }, [refreshUser]);

  // -- Native IAP purchase --
  const handlePurchase = useCallback(
    async (productId: string) => {
      setError(null);
      setSuccessMessage(null);
      setPurchasing(true);
      try {
        await purchaseSubscription(productId);
        // The purchase listener will handle the result
      } catch (err) {
        setPurchasing(false);
        setError(err instanceof Error ? err.message : "Purchase failed");
      }
    },
    []
  );

  // -- Native restore --
  const handleRestore = useCallback(async () => {
    setError(null);
    setSuccessMessage(null);
    setRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.success) {
        setSuccessMessage("Subscription restored!");
        refreshUser();
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }, [refreshUser]);

  // -- Web / Stripe fallback --
  const checkout = useMutation({
    mutationFn: async () => {
      const result = await api.rpc<{ success: boolean; message: string; url?: string }>(
        "createMobileCheckout"
      );
      if (!result.success || !result.url) {
        throw new Error(result.message || "Failed to start checkout");
      }
      return result.url;
    },
    onSuccess: async (url) => {
      setError(null);
      await WebBrowser.openBrowserAsync(url);
      refreshUser();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  const manageSub = useMutation({
    mutationFn: async () => {
      const result = await api.rpc<{ success: boolean; message: string; url?: string }>(
        "createBillingPortalSession"
      );
      if (!result.success || !result.url) {
        throw new Error(result.message || "Failed to open billing portal");
      }
      return result.url;
    },
    onSuccess: async (url) => {
      setError(null);
      await WebBrowser.openBrowserAsync(url);
      refreshUser();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Something went wrong");
    },
  });

  // Helper to find a product by ID
  const monthlyProduct = products.find(
    (p) => p.productId === "com.vibrantsocial.premium.monthly"
  );
  const yearlyProduct = products.find(
    (p) => p.productId === "com.vibrantsocial.premium.yearly"
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ padding: 24, alignItems: "center" }}>
        {/* Header icon */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "#c026d3",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>+</Text>
        </View>
        <Text style={{ fontSize: 28, fontWeight: "700", color: "#1f2937" }}>
          Premium
        </Text>
        <Text style={{ fontSize: 15, color: "#6b7280", marginTop: 6, textAlign: "center" }}>
          Stand out with profile customization and exclusive features.
        </Text>
      </View>

      {/* Features list */}
      <View
        style={{
          marginHorizontal: 16,
          backgroundColor: "#faf5ff",
          borderRadius: 16,
          padding: 20,
        }}
      >
        {FEATURES.map((feature) => (
          <View
            key={feature.title}
            style={{ flexDirection: "row", marginBottom: 16, gap: 12 }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#f3e8ff",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 2,
              }}
            >
              <Text style={{ color: "#c026d3", fontSize: 14, fontWeight: "700" }}>
                {"\u2713"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#1f2937" }}>
                {feature.title}
              </Text>
              <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                {feature.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Plan comparison */}
      <View style={{ marginHorizontal: 16, marginTop: 24 }}>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#1f2937", marginBottom: 12 }}>
          Compare Plans
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {/* Free column */}
          <View
            style={{
              flex: 1,
              backgroundColor: "#f9fafb",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: "#e5e7eb",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#6b7280", marginBottom: 12 }}>
              Free
            </Text>
            {FREE_LIMITS.map((item) => (
              <Text
                key={item}
                style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}
              >
                {item}
              </Text>
            ))}
          </View>
          {/* Premium column */}
          <View
            style={{
              flex: 1,
              backgroundColor: "#faf5ff",
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: "#e9d5ff",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#c026d3", marginBottom: 12 }}>
              Premium
            </Text>
            {PREMIUM_LIMITS.map((item) => (
              <Text
                key={item}
                style={{ fontSize: 13, color: "#7c3aed", marginBottom: 6 }}
              >
                {item}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* Action area */}
      <View style={{ padding: 24 }}>
        {/* Success message */}
        {successMessage && (
          <View
            style={{
              backgroundColor: "#f0fdf4",
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#16a34a", fontWeight: "600", fontSize: 15 }}>
              {successMessage}
            </Text>
          </View>
        )}

        {/* Error message */}
        {error && (
          <Text style={{ color: "#ef4444", fontSize: 14, textAlign: "center", marginBottom: 12 }}>
            {error}
          </Text>
        )}

        {isPremium ? (
          /* ─── Premium member: manage subscription ─── */
          <View>
            <View
              style={{
                backgroundColor: "#f3e8ff",
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#c026d3", fontWeight: "600", fontSize: 15 }}>
                Premium Member
              </Text>
            </View>
            <Text style={{ color: "#6b7280", fontSize: 14, textAlign: "center", marginBottom: 16 }}>
              You have access to all premium features. Manage your subscription below.
            </Text>

            {isNative ? (
              /* Native: manage through App Store / Google Play */
              <View>
                <Text style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", marginBottom: 12 }}>
                  {Platform.OS === "ios"
                    ? "Manage your subscription in your Apple ID settings."
                    : "Manage your subscription in Google Play."}
                </Text>
                <TouchableOpacity
                  onPress={handleRestore}
                  disabled={restoring}
                  style={{
                    backgroundColor: "#1f2937",
                    borderRadius: 12,
                    padding: 16,
                    alignItems: "center",
                    opacity: restoring ? 0.6 : 1,
                  }}
                >
                  {restoring ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                      Restore Purchases
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* Web: Stripe billing portal */
              <TouchableOpacity
                onPress={() => manageSub.mutate()}
                disabled={manageSub.isPending}
                style={{
                  backgroundColor: "#1f2937",
                  borderRadius: 12,
                  padding: 16,
                  alignItems: "center",
                  opacity: manageSub.isPending ? 0.6 : 1,
                }}
              >
                {manageSub.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                    Manage Subscription
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : isNative ? (
          /* ─── Native: IAP subscription options ─── */
          <View>
            {loadingProducts ? (
              <ActivityIndicator color="#c026d3" size="large" style={{ marginVertical: 20 }} />
            ) : products.length > 0 ? (
              <View style={{ gap: 12 }}>
                {/* Monthly option */}
                {monthlyProduct && (
                  <TouchableOpacity
                    onPress={() => handlePurchase(monthlyProduct.productId)}
                    disabled={purchasing}
                    style={{
                      backgroundColor: "#c026d3",
                      borderRadius: 12,
                      padding: 16,
                      alignItems: "center",
                      opacity: purchasing ? 0.6 : 1,
                    }}
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                          Monthly
                        </Text>
                        <Text style={{ color: "#f3e8ff", fontSize: 14, marginTop: 2 }}>
                          {monthlyProduct.localizedPrice}/month
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {/* Yearly option */}
                {yearlyProduct && (
                  <TouchableOpacity
                    onPress={() => handlePurchase(yearlyProduct.productId)}
                    disabled={purchasing}
                    style={{
                      backgroundColor: "#7c3aed",
                      borderRadius: 12,
                      padding: 16,
                      alignItems: "center",
                      opacity: purchasing ? 0.6 : 1,
                    }}
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                          Yearly
                        </Text>
                        <Text style={{ color: "#ede9fe", fontSize: 14, marginTop: 2 }}>
                          {yearlyProduct.localizedPrice}/year
                        </Text>
                        <Text style={{ color: "#ddd6fe", fontSize: 12, marginTop: 2 }}>
                          Save with annual billing
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}

                {/* Restore button */}
                <TouchableOpacity
                  onPress={handleRestore}
                  disabled={restoring}
                  style={{
                    borderWidth: 1,
                    borderColor: "#d1d5db",
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                    opacity: restoring ? 0.6 : 1,
                  }}
                >
                  {restoring ? (
                    <ActivityIndicator color="#6b7280" />
                  ) : (
                    <Text style={{ color: "#6b7280", fontWeight: "600", fontSize: 15 }}>
                      Restore Purchases
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* Fallback when products can't be loaded */
              <View>
                <Text
                  style={{
                    color: "#6b7280",
                    fontSize: 14,
                    textAlign: "center",
                    marginBottom: 16,
                  }}
                >
                  Subscription products are not available right now. Please try
                  again later.
                </Text>
                <TouchableOpacity
                  onPress={handleRestore}
                  disabled={restoring}
                  style={{
                    borderWidth: 1,
                    borderColor: "#d1d5db",
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                    opacity: restoring ? 0.6 : 1,
                  }}
                >
                  {restoring ? (
                    <ActivityIndicator color="#6b7280" />
                  ) : (
                    <Text style={{ color: "#6b7280", fontWeight: "600", fontSize: 15 }}>
                      Restore Purchases
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          /* ─── Web: Stripe checkout ─── */
          <TouchableOpacity
            onPress={() => checkout.mutate()}
            disabled={checkout.isPending}
            style={{
              backgroundColor: "#c026d3",
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              opacity: checkout.isPending ? 0.6 : 1,
            }}
          >
            {checkout.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Upgrade to Premium
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
