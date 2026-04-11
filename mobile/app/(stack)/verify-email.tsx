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
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);

  async function handleSendCode() {
    setSendingCode(true);
    try {
      await api.rpc("sendEmailVerification");
      setCodeSent(true);
      Toast.show({ type: "success", text1: "Verification code sent to your email" });
    } catch {
      Toast.show({ type: "error", text1: "Failed to send verification code" });
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerify() {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const result = await api.rpc<{ success: boolean; message?: string }>("verifyEmail", code.trim());
      if (result.success) {
        setVerified(true);
        Toast.show({ type: "success", text1: "Email verified!" });
      } else {
        Toast.show({ type: "error", text1: result.message || "Invalid code" });
      }
    } catch {
      Toast.show({ type: "error", text1: "Verification failed" });
    } finally {
      setLoading(false);
    }
  }

  if (verified) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>✓</Text>
        <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 8 }}>Email Verified</Text>
        <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
          Your email address has been successfully verified.
        </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#c026d3", fontWeight: "600", fontSize: 16 }}>Go back</Text>
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
        <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Verify your email</Text>
        <Text style={{ color: "#6b7280", marginBottom: 24 }}>
          We'll send a verification code to the email address on your account.
        </Text>

        {!codeSent ? (
          <TouchableOpacity
            onPress={handleSendCode}
            disabled={sendingCode}
            style={{
              backgroundColor: "#c026d3",
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              opacity: sendingCode ? 0.7 : 1,
            }}
          >
            {sendingCode ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Send verification code</Text>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <TextInput
              placeholder="Enter verification code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
              style={{
                borderWidth: 1,
                borderColor: "#d1d5db",
                borderRadius: 12,
                padding: 16,
                fontSize: 18,
                marginBottom: 16,
                textAlign: "center",
                letterSpacing: 4,
              }}
            />

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading || !code.trim()}
              style={{
                backgroundColor: "#c026d3",
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
                opacity: loading || !code.trim() ? 0.7 : 1,
                marginBottom: 16,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSendCode} disabled={sendingCode}>
              <Text style={{ color: "#c026d3", textAlign: "center", fontWeight: "600" }}>
                {sendingCode ? "Sending..." : "Resend code"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
