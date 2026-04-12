import { useEffect } from "react";
import { View, ActivityIndicator, Text, TextInput } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { registerForPushNotifications } from "@/lib/notifications";
import { ablyClient } from "@/lib/ably";
import { initIAP, endIAP } from "@/lib/iap";
import { useAppFonts } from "@/hooks/use-app-fonts";

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

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(stack)" options={{ headerShown: true }} />
        <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
      </Stack>
      <StatusBar style="auto" />
      <Toast />
    </>
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
