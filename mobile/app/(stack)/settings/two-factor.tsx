import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Stack } from "expo-router";
import { api } from "@/lib/api";

type Step = "idle" | "setup" | "verify" | "backup-codes" | "disable";

interface SetupResult {
  success: boolean;
  message: string;
  secret?: string;
  uri?: string;
}

interface ConfirmResult {
  success: boolean;
  message: string;
  backupCodes?: string[];
}

export default function TwoFactorScreen() {
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [secret, setSecret] = useState<string | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [message, setMessage] = useState<{
    text: string;
    success: boolean;
  } | null>(null);

  // Check 2FA status on mount
  useEffect(() => {
    api
      .get<{ twoFactorEnabled: boolean }>("/api/auth/mobile/me")
      .then((data) => {
        // The /me endpoint returns user data; check for 2FA field
        const userData = data as any;
        if (userData.user?.twoFactorEnabled) {
          setEnabled(true);
        }
      })
      .catch(() => {})
      .finally(() => setStatusLoading(false));
  }, []);

  async function handleBeginSetup() {
    setIsLoading(true);
    setMessage(null);
    try {
      const result = await api.rpc<SetupResult>("beginTOTPSetup");
      if (result.success && result.secret && result.uri) {
        setSecret(result.secret);
        setQrUri(result.uri);
        setStep("setup");
      } else {
        setMessage({ text: result.message, success: false });
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Setup failed",
        success: false,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (code.length !== 6) return;
    setIsLoading(true);
    setMessage(null);
    try {
      const result = await api.rpc<ConfirmResult>("confirmTOTPSetup", code);
      if (result.success && result.backupCodes) {
        setBackupCodes(result.backupCodes);
        setEnabled(true);
        setStep("backup-codes");
      } else {
        setMessage({ text: result.message, success: false });
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Verification failed",
        success: false,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisable() {
    if (!password) {
      Alert.alert("Error", "Password is required");
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const result = await api.rpc<{ success: boolean; message: string }>(
        "disableTwoFactor",
        password
      );
      if (result.success) {
        setEnabled(false);
        setStep("idle");
        setPassword("");
        setMessage({ text: result.message, success: true });
      } else {
        setMessage({ text: result.message, success: false });
      }
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Failed to disable 2FA",
        success: false,
      });
    } finally {
      setIsLoading(false);
    }
  }

  function copyBackupCodes() {
    // Show codes in an alert so user can manually copy
    Alert.alert(
      "Backup Codes",
      backupCodes.join("\n"),
      [{ text: "OK" }]
    );
  }

  if (statusLoading) {
    return (
      <>
        <Stack.Screen options={{ title: "Two-Factor Authentication" }} />
        <View
          style={{
            flex: 1,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color="#c026d3" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Two-Factor Authentication" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status Badge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <View
            style={{
              backgroundColor: enabled ? "#dcfce7" : "#f3f4f6",
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                color: enabled ? "#16a34a" : "#6b7280",
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {enabled ? "Enabled" : "Not enabled"}
            </Text>
          </View>
        </View>

        <Text style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
          Add extra security to your account with an authenticator app.
        </Text>

        {/* IDLE state */}
        {step === "idle" && !enabled && (
          <TouchableOpacity
            onPress={handleBeginSetup}
            disabled={isLoading}
            style={{
              backgroundColor: "#c026d3",
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Set Up Two-Factor
              </Text>
            )}
          </TouchableOpacity>
        )}

        {step === "idle" && enabled && (
          <View>
            <TouchableOpacity
              onPress={() => {
                setStep("disable");
                setPassword("");
                setMessage(null);
              }}
              style={{
                borderWidth: 1,
                borderColor: "#fecaca",
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#ef4444", fontWeight: "600", fontSize: 16 }}>
                Disable Two-Factor
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SETUP: QR Code + Secret */}
        {step === "setup" && qrUri && secret && (
          <View>
            <View
              style={{
                backgroundColor: "#f9fafb",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#374151",
                  marginBottom: 12,
                }}
              >
                Scan this QR code with your authenticator app:
              </Text>
              <View style={{ alignItems: "center" }}>
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`,
                  }}
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: 8,
                    backgroundColor: "#fff",
                  }}
                />
              </View>
              <Text
                style={{
                  color: "#6b7280",
                  fontSize: 12,
                  marginTop: 12,
                }}
              >
                Or enter this key manually:
              </Text>
              <View
                style={{
                  backgroundColor: "#e5e7eb",
                  borderRadius: 8,
                  padding: 8,
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    color: "#374151",
                    textAlign: "center",
                  }}
                  selectable
                >
                  {secret}
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Enter 6-digit code from your app:</Text>
            <TextInput
              style={[styles.input, { textAlign: "center", letterSpacing: 8, fontSize: 20 }]}
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={handleVerifyCode}
                disabled={isLoading || code.length !== 6}
                style={{
                  flex: 1,
                  backgroundColor: "#c026d3",
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                  opacity: isLoading || code.length !== 6 ? 0.6 : 1,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    Verify & Enable
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setStep("idle");
                  setCode("");
                  setMessage(null);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                  paddingHorizontal: 20,
                }}
              >
                <Text style={{ color: "#6b7280", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* BACKUP CODES */}
        {step === "backup-codes" && backupCodes.length > 0 && (
          <View>
            <View
              style={{
                backgroundColor: "#fefce8",
                borderWidth: 1,
                borderColor: "#fde68a",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: "#92400e",
                  marginBottom: 8,
                }}
              >
                Save your backup codes
              </Text>
              <Text style={{ color: "#a16207", fontSize: 13, marginBottom: 12 }}>
                Store these codes in a safe place. Each code can only be used once.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {backupCodes.map((c, i) => (
                  <View
                    key={i}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      minWidth: "45%",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "monospace",
                        fontSize: 13,
                        color: "#374151",
                        textAlign: "center",
                      }}
                      selectable
                    >
                      {c}
                    </Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                onPress={copyBackupCodes}
                style={{
                  borderWidth: 1,
                  borderColor: "#fcd34d",
                  borderRadius: 8,
                  padding: 10,
                  alignItems: "center",
                  marginTop: 12,
                }}
              >
                <Text style={{ color: "#92400e", fontWeight: "600", fontSize: 14 }}>
                  Copy All Codes
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                setStep("idle");
                setBackupCodes([]);
                setCode("");
              }}
              style={{
                backgroundColor: "#c026d3",
                borderRadius: 12,
                padding: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DISABLE: Password confirmation */}
        {step === "disable" && (
          <View>
            <Text style={{ color: "#6b7280", fontSize: 14, marginBottom: 12 }}>
              Enter your password to disable two-factor authentication.
            </Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={handleDisable}
                disabled={isLoading || !password}
                style={{
                  flex: 1,
                  backgroundColor: "#ef4444",
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                  opacity: isLoading || !password ? 0.6 : 1,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>
                    Disable 2FA
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setStep("idle");
                  setMessage(null);
                }}
                style={{
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                  paddingHorizontal: 20,
                }}
              >
                <Text style={{ color: "#6b7280", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Message */}
        {message && (
          <Text
            style={{
              marginTop: 16,
              fontSize: 13,
              color: message.success ? "#16a34a" : "#ef4444",
            }}
          >
            {message.text}
          </Text>
        )}
      </ScrollView>
    </>
  );
}

const styles = {
  label: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#f9fafb",
    marginBottom: 16,
  },
};
