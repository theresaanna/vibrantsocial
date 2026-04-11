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

export default function AppealScreen() {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!reason.trim() || !details.trim()) {
      Toast.show({ type: "error", text1: "Please fill in all fields" });
      return;
    }

    setLoading(true);
    try {
      const result = await api.rpc<{ success: boolean; message?: string }>(
        "submitAppeal",
        { reason: reason.trim(), details: details.trim() }
      );
      if (result.success) {
        setSubmitted(true);
      } else {
        Toast.show({ type: "error", text1: result.message || "Failed to submit appeal" });
      }
    } catch {
      Toast.show({ type: "error", text1: "Failed to submit appeal" });
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>✓</Text>
        <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 8 }}>Appeal Submitted</Text>
        <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
          We've received your appeal and will review it as soon as possible. You'll be notified of the outcome.
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
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Appeal an Action</Text>
        <Text style={{ color: "#6b7280", marginBottom: 24 }}>
          If you believe an action taken against your account was incorrect, you can submit an appeal here.
        </Text>

        <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Reason for Appeal</Text>
        <TextInput
          placeholder="e.g. Content removal, account suspension"
          value={reason}
          onChangeText={setReason}
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            marginBottom: 16,
          }}
        />

        <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Details</Text>
        <TextInput
          placeholder="Please explain why you believe the action was incorrect..."
          value={details}
          onChangeText={setDetails}
          multiline
          numberOfLines={6}
          style={{
            borderWidth: 1,
            borderColor: "#d1d5db",
            borderRadius: 12,
            padding: 16,
            fontSize: 16,
            marginBottom: 24,
            minHeight: 150,
            textAlignVertical: "top",
          }}
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || !reason.trim() || !details.trim()}
          style={{
            backgroundColor: "#c026d3",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            opacity: loading || !reason.trim() || !details.trim() ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Submit Appeal</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
