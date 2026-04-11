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
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleReset() {
    if (!password || password.length < 8) {
      Toast.show({ type: "error", text1: "Password must be at least 8 characters" });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({ type: "error", text1: "Passwords do not match" });
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/mobile/reset-password", {
        token,
        password,
      });
      setSuccess(true);
      Toast.show({ type: "success", text1: "Password reset successfully" });
    } catch {
      Toast.show({ type: "error", text1: "Failed to reset password. The link may have expired." });
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 8 }}>Invalid reset link</Text>
        <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
          This password reset link is invalid or incomplete.
        </Text>
        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <Text style={{ color: "#c026d3", fontWeight: "600" }}>Go to login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (success) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>✓</Text>
        <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 8 }}>Password Reset</Text>
        <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
          Your password has been reset. You can now log in with your new password.
        </Text>
        <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
          <Text style={{ color: "#c026d3", fontWeight: "600", fontSize: 16 }}>Go to login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Reset password</Text>
        <Text style={{ color: "#6b7280", marginBottom: 24 }}>
          Enter your new password below.
        </Text>

        <TextInput
          placeholder="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="password-new"
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
          placeholder="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          textContentType="newPassword"
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            marginBottom: 24,
          }}
        />

        <TouchableOpacity
          onPress={handleReset}
          disabled={loading}
          style={{
            backgroundColor: "#c026d3",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Reset password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
