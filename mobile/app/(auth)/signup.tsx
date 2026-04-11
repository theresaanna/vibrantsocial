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
  Switch,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import Toast from "react-native-toast-message";

export default function SignupScreen() {
  const { signup } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [agreeToTos, setAgreeToTos] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!email.trim() || !username.trim() || !password || !confirmPassword || !dateOfBirth) {
      Toast.show({ type: "error", text1: "Please fill in all fields" });
      return;
    }
    if (!agreeToTos) {
      Toast.show({ type: "error", text1: "You must agree to the Terms of Service" });
      return;
    }

    setLoading(true);
    try {
      const result = await signup({
        email: email.trim(),
        username: username.trim(),
        password,
        confirmPassword,
        dateOfBirth,
        agreeToTos: "true",
      });
      if (result.success) {
        router.replace("/(tabs)");
      } else {
        Toast.show({ type: "error", text1: result.error || "Signup failed" });
      }
    } finally {
      setLoading(false);
    }
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
        <Text style={{ fontSize: 32, fontWeight: "800", color: "#c026d3", textAlign: "center", marginBottom: 8 }}>
          VibrantSocial
        </Text>
        <Text style={{ fontSize: 16, color: "#6b7280", textAlign: "center", marginBottom: 32 }}>
          Create your account
        </Text>

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          style={inputStyle}
        />

        <TextInput
          placeholder="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle}
        />

        <TextInput
          placeholder="Date of birth (YYYY-MM-DD)"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          keyboardType="numbers-and-punctuation"
          style={inputStyle}
        />

        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          style={inputStyle}
        />

        <TextInput
          placeholder="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          style={inputStyle}
        />

        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <Switch
            value={agreeToTos}
            onValueChange={setAgreeToTos}
            trackColor={{ true: "#c026d3" }}
          />
          <Text style={{ color: "#6b7280", marginLeft: 8, flex: 1 }}>
            I agree to the Terms of Service and Privacy Policy
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSignup}
          disabled={loading}
          style={{
            backgroundColor: "#c026d3",
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            opacity: loading ? 0.7 : 1,
            marginBottom: 16,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>Create account</Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          <Text style={{ color: "#6b7280" }}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={{ color: "#c026d3", fontWeight: "600" }}>Log in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: "#d1d5db",
  borderRadius: 12,
  padding: 16,
  fontSize: 16,
  marginBottom: 12,
} as const;
