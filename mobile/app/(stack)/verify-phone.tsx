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

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);

  async function handleSendCode() {
    if (!phone.trim()) return;
    setSendingCode(true);
    try {
      const result = await api.rpc<{ success: boolean; message?: string }>(
        "sendPhoneVerification",
        phone.trim()
      );
      if (result.success) {
        setCodeSent(true);
        Toast.show({ type: "success", text1: "Verification code sent via SMS" });
      } else {
        Toast.show({ type: "error", text1: result.message || "Failed to send code" });
      }
    } catch {
      Toast.show({ type: "error", text1: "Failed to send verification code" });
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerify() {
    if (!code.trim() || code.length < 6) return;
    setLoading(true);
    try {
      const result = await api.rpc<{ success: boolean; message?: string }>(
        "verifyPhone",
        phone.trim(),
        code.trim()
      );
      if (result.success) {
        setVerified(true);
        Toast.show({ type: "success", text1: "Phone verified!" });
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
        <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 8 }}>Phone Verified</Text>
        <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
          Your phone number has been successfully verified.
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
        <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Verify your phone</Text>
        <Text style={{ color: "#6b7280", marginBottom: 24 }}>
          Add a phone number to secure your account. We'll send a 6-digit code via SMS.
        </Text>

        {!codeSent ? (
          <>
            <TextInput
              placeholder="Phone number (e.g. +1234567890)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
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
              onPress={handleSendCode}
              disabled={sendingCode || !phone.trim()}
              style={{
                backgroundColor: "#c026d3",
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
                opacity: sendingCode || !phone.trim() ? 0.7 : 1,
              }}
            >
              {sendingCode ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Send code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={{ color: "#6b7280", marginBottom: 16 }}>
              Code sent to {phone}
            </Text>

            <TextInput
              placeholder="000000"
              value={code}
              onChangeText={(t) => setCode(t.replace(/[^0-9]/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
              style={{
                borderWidth: 1,
                borderColor: "#d1d5db",
                borderRadius: 12,
                padding: 16,
                fontSize: 24,
                marginBottom: 16,
                textAlign: "center",
                letterSpacing: 8,
              }}
            />

            <TouchableOpacity
              onPress={handleVerify}
              disabled={loading || code.length < 6}
              style={{
                backgroundColor: "#c026d3",
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
                opacity: loading || code.length < 6 ? 0.7 : 1,
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
