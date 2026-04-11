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
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, setAuthToken } from "@/lib/api";
import Toast from "react-native-toast-message";

export default function TwoFactorScreen() {
  const { pendingToken } = useLocalSearchParams<{ pendingToken: string }>();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const result = await api.post<{ token: string }>("/api/auth/mobile/login/2fa", {
        pendingToken,
        code,
      });
      await setAuthToken(result.token);
      router.replace("/(tabs)");
    } catch {
      Toast.show({ type: "error", text1: "Invalid code. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Two-factor authentication</Text>
        <Text style={{ color: "#6b7280", marginBottom: 24 }}>
          Enter the 6-digit code from your authenticator app.
        </Text>

        <TextInput
          placeholder="000000"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 16,
            fontSize: 24,
            textAlign: "center",
            letterSpacing: 8,
            marginBottom: 24,
          }}
        />

        <TouchableOpacity
          onPress={handleVerify}
          disabled={loading || code.length !== 6}
          style={{
            backgroundColor: "#c026d3",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            opacity: loading || code.length !== 6 ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Verify</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
