import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import type { OAuthProvider } from "@/lib/oauth";
import Toast from "react-native-toast-message";

export default function LoginScreen() {
  const { login, loginWithOAuth } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.success) {
        router.replace("/(tabs)");
      } else if (result.requires2fa) {
        router.push({
          pathname: "/(auth)/two-factor",
          params: { pendingToken: result.pendingToken },
        });
      } else {
        Toast.show({ type: "error", text1: result.error || "Login failed" });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    setOauthLoading(provider);
    try {
      const result = await loginWithOAuth(provider);
      if (result.success) {
        router.replace("/(tabs)");
      } else if (result.error && result.error !== "Login cancelled") {
        Toast.show({ type: "error", text1: result.error });
      }
    } finally {
      setOauthLoading(null);
    }
  }

  const isAnyLoading = loading || oauthLoading !== null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 32, fontWeight: "800", color: "#c026d3", textAlign: "center", marginBottom: 8 }}>
          VibrantSocial
        </Text>
        <Text style={{ fontSize: 16, color: "#6b7280", textAlign: "center", marginBottom: 32 }}>
          Welcome back
        </Text>

        {/* OAuth Buttons */}
        <TouchableOpacity
          onPress={() => handleOAuth("google")}
          disabled={isAnyLoading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
            opacity: isAnyLoading ? 0.7 : 1,
          }}
        >
          {oauthLoading === "google" ? (
            <ActivityIndicator color="#4285F4" style={{ marginRight: 12 }} />
          ) : (
            <Text style={{ fontSize: 18, marginRight: 12 }}>G</Text>
          )}
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#374151" }}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleOAuth("discord")}
          disabled={isAnyLoading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#5865F2",
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            opacity: isAnyLoading ? 0.7 : 1,
          }}
        >
          {oauthLoading === "discord" ? (
            <ActivityIndicator color="#fff" style={{ marginRight: 12 }} />
          ) : (
            <Text style={{ fontSize: 16, marginRight: 12, color: "#fff" }}>🎮</Text>
          )}
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
            Continue with Discord
          </Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
          <Text style={{ marginHorizontal: 16, color: "#9ca3af", fontSize: 14 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
        </View>

        {/* Email/Password */}
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          editable={!isAnyLoading}
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            marginBottom: 12,
          }}
        />

        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          editable={!isAnyLoading}
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            marginBottom: 8,
          }}
        />

        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity style={{ alignSelf: "flex-end", marginBottom: 24 }}>
            <Text style={{ color: "#c026d3", fontSize: 14 }}>Forgot password?</Text>
          </TouchableOpacity>
        </Link>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={isAnyLoading}
          style={{
            backgroundColor: "#c026d3",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            opacity: isAnyLoading ? 0.7 : 1,
            marginBottom: 16,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Log in</Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          <Text style={{ color: "#6b7280" }}>Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={{ color: "#c026d3", fontWeight: "600" }}>Sign up</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
