import { useEffect } from "react";
import { View, ActivityIndicator, Text, TextInput } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { registerForPushNotifications } from "@/lib/notifications";
import { ablyClient } from "@/lib/ably";
import { initIAP, endIAP } from "@/lib/iap";
import { useAppFonts } from "@/hooks/use-app-fonts";
import { ThemedView } from "@/components/themed-view";
import { useMyTheme } from "@/hooks/use-my-theme";
import { Sparklefall } from "@/components/sparklefall";
import { NavBar } from "@/components/nav-bar";

// Set Lexend 300 as the default font for all Text and TextInput components
const DEFAULT_FONT = "Lexend_300Light";
const originalTextRender = (Text as any).render;
if (originalTextRender) {
  (Text as any).render = function (props: any, ref: any) {
    return originalTextRender.call(this, {
      ...props,
      style: [{ fontFamily: DEFAULT_FONT }, props.style],
    }, ref);
  };
}
const originalTextInputRender = (TextInput as any).render;
if (originalTextInputRender) {
  (TextInput as any).render = function (props: any, ref: any) {
    return originalTextInputRender.call(this, {
      ...props,
      style: [{ fontFamily: DEFAULT_FONT }, props.style],
    }, ref);
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 2,
    },
  },
});

function handleDeepLink(url: string, router: ReturnType<typeof useRouter>) {
  try {
    const parsed = Linking.parse(url);
    const path = parsed.path;
    if (!path) return;

    // Map deep link paths to app routes
    if (path.startsWith("reset-password")) {
      router.push({ pathname: "/(auth)/reset-password", params: parsed.queryParams ?? {} });
    } else if (path.startsWith("verify-email")) {
      router.push("/(stack)/verify-email");
    } else if (path.startsWith("verify-phone")) {
      router.push("/(stack)/verify-phone");
    } else if (path.startsWith("post/")) {
      const postId = path.replace("post/", "");
      if (postId) router.push(`/(stack)/post/${postId}`);
    } else if (path.startsWith("privacy")) {
      router.push("/(stack)/policy/privacy");
    } else if (path.startsWith("tos")) {
      router.push("/(stack)/policy/tos");
    }
  } catch {
    // Silently ignore malformed URLs
  }
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { data: myTheme } = useMyTheme();

  // Initialize IAP connection on mount, clean up on unmount
  useEffect(() => {
    initIAP();
    return () => {
      endIAP();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications();
      ablyClient.connect();
    } else {
      ablyClient.close();
    }
  }, [isAuthenticated]);

  // Handle deep links on startup and while app is running
  useEffect(() => {
    // Handle initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url, router);
    });

    // Handle URLs while app is already open
    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url, router);
    });

    return () => subscription.remove();
  }, [router]);

  // Parse sparklefall emoji from theme
  const sparklefallEmoji = (() => {
    const raw = myTheme?.sparklefallSparkles;
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return raw.split(",");
  })();

  return (
    <ThemedView themeData={isAuthenticated ? myTheme : undefined} showBgImage={false}>
      {isAuthenticated && (
        <SafeAreaView edges={["top"]} style={{ backgroundColor: "#ffffff" }}>
          <NavBar />
        </SafeAreaView>
      )}
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(stack)" />
          <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
        </Stack>
      </View>
      {isAuthenticated && myTheme?.sparklefallEnabled && (
        <Sparklefall
          presetName={myTheme.sparklefallPreset ?? "default"}
          sparkles={sparklefallEmoji}
          interval={myTheme.sparklefallInterval ?? undefined}
          wind={myTheme.sparklefallWind ?? undefined}
          maxSparkles={myTheme.sparklefallMaxSparkles ?? undefined}
          minSize={myTheme.sparklefallMinSize ?? undefined}
          maxSize={myTheme.sparklefallMaxSize ?? undefined}
        />
      )}
      <StatusBar style="auto" />
      <Toast />
    </ThemedView>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#c026d3" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
