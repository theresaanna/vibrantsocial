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
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import Toast from "react-native-toast-message";

export default function AgeVerifyScreen() {
  const router = useRouter();
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  function isValidDate(): boolean {
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);
    if (!m || !d || !y) return false;
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    if (y < 1900 || y > new Date().getFullYear()) return false;
    return true;
  }

  function getAge(): number {
    const dob = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  async function handleVerify() {
    if (!isValidDate()) {
      Toast.show({ type: "error", text1: "Please enter a valid date of birth" });
      return;
    }

    const age = getAge();
    if (age < 13) {
      Alert.alert("Age Requirement", "You must be at least 13 years old to use VibrantSocial.");
      return;
    }

    setLoading(true);
    try {
      const dateOfBirth = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      const result = await api.rpc<{ success: boolean; message?: string }>(
        "updateProfile",
        { dateOfBirth }
      );
      if (result && (result as any).success !== false) {
        setVerified(true);
        Toast.show({ type: "success", text1: "Age verified!" });
      } else {
        Toast.show({ type: "error", text1: (result as any)?.message || "Verification failed" });
      }
    } catch {
      Toast.show({ type: "error", text1: "Failed to verify age" });
    } finally {
      setLoading(false);
    }
  }

  if (verified) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>✓</Text>
        <Text style={{ fontSize: 20, fontWeight: "600", marginBottom: 8 }}>Age Verified</Text>
        <Text style={{ color: "#6b7280", textAlign: "center", marginBottom: 24 }}>
          Your date of birth has been recorded.
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
        <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Verify your age</Text>
        <Text style={{ color: "#6b7280", marginBottom: 24 }}>
          Age verification is required to access certain content. Enter your date of birth below.
        </Text>

        <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 }}>Date of Birth</Text>

        <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
          <TextInput
            placeholder="MM"
            value={month}
            onChangeText={(t) => setMonth(t.replace(/[^0-9]/g, "").slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              padding: 16,
              fontSize: 18,
              textAlign: "center",
            }}
          />
          <TextInput
            placeholder="DD"
            value={day}
            onChangeText={(t) => setDay(t.replace(/[^0-9]/g, "").slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              padding: 16,
              fontSize: 18,
              textAlign: "center",
            }}
          />
          <TextInput
            placeholder="YYYY"
            value={year}
            onChangeText={(t) => setYear(t.replace(/[^0-9]/g, "").slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            style={{
              flex: 2,
              borderWidth: 1,
              borderColor: "#d1d5db",
              borderRadius: 12,
              padding: 16,
              fontSize: 18,
              textAlign: "center",
            }}
          />
        </View>

        <TouchableOpacity
          onPress={handleVerify}
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
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Verify age</Text>
          )}
        </TouchableOpacity>

        <Text style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", marginTop: 16 }}>
          Your date of birth is stored securely and used only for age verification purposes.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
