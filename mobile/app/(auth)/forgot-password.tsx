import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.post("/api/auth/mobile/forgot-password", { email: email.trim() });
      setSent(true);
      Toast.show({ type: "success", text1: "Reset email sent" });
    } catch {
      Toast.show({ type: "error", text1: "Failed to send reset email" });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 8 }}>Check your email</Text>
        <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
          We sent a password reset link to {email}
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#c026d3", fontWeight: "600" }}>Back to login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Reset password</Text>
        <Text style={{ color: "#6b7280", marginBottom: 24 }}>
          Enter your email and we'll send you a reset link.
        </Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            marginBottom: 16,
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
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Send reset link</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
