import { useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

type ContentType = "post" | "comment" | "profile" | "conversation";

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: ContentType;
  contentId: string;
}

const CATEGORIES = [
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "nudity_unmarked", label: "NSFW / Unmarked adult content" },
  { value: "impersonation", label: "Impersonation" },
  { value: "violence", label: "Violence or threats" },
  { value: "self_harm", label: "Self-harm or suicide" },
  { value: "csam", label: "Child exploitation (CSAM)" },
  { value: "privacy", label: "Privacy violation" },
  { value: "other", label: "Other" },
] as const;

const LABELS: Record<ContentType, string> = {
  post: "Report Post",
  comment: "Report Comment",
  profile: "Report User",
  conversation: "Report Conversation",
};

export function ReportModal({ visible, onClose, contentType, contentId }: ReportModalProps) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState(false);

  const submitReport = useMutation({
    mutationFn: () =>
      api.rpc<{ success: boolean; message: string }>("reportContent", {
        contentType,
        contentId,
        category,
        description: description.trim(),
      }),
    onSuccess: (result) => {
      if (result.success) {
        setSuccess(true);
      }
    },
  });

  const handleClose = () => {
    setCategory("");
    setDescription("");
    setSuccess(false);
    submitReport.reset();
    onClose();
  };

  const canSubmit = category !== "" && description.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "flex-end",
        }}
        onPress={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "85%",
            }}
          >
            <ScrollView bounces={false}>
              {/* Handle bar */}
              <View style={{ alignItems: "center", paddingTop: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "#d1d5db",
                  }}
                />
              </View>

              <View style={{ padding: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: "#1f2937" }}>
                  {LABELS[contentType]}
                </Text>

                {success ? (
                  <View style={{ marginTop: 20 }}>
                    <Text style={{ fontSize: 15, color: "#059669", marginBottom: 20 }}>
                      Thank you for your report. A human will review this and respond as soon as
                      possible.
                    </Text>
                    <TouchableOpacity
                      onPress={handleClose}
                      style={{
                        backgroundColor: "#1f2937",
                        borderRadius: 12,
                        padding: 14,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                        Close
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={{ fontSize: 14, color: "#6b7280", marginTop: 8 }}>
                      Please select a reason and describe the issue.
                    </Text>

                    {/* Category picker */}
                    <View style={{ marginTop: 16 }}>
                      {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                          key={cat.value}
                          onPress={() => setCategory(cat.value)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            backgroundColor: category === cat.value ? "#fdf2f8" : "transparent",
                            marginBottom: 2,
                          }}
                        >
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 10,
                              borderWidth: 2,
                              borderColor: category === cat.value ? "#c026d3" : "#d1d5db",
                              alignItems: "center",
                              justifyContent: "center",
                              marginRight: 10,
                            }}
                          >
                            {category === cat.value && (
                              <View
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 5,
                                  backgroundColor: "#c026d3",
                                }}
                              />
                            )}
                          </View>
                          <Text style={{ fontSize: 15, color: "#1f2937" }}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Description */}
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Describe what you are reporting..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      maxLength={2000}
                      style={{
                        marginTop: 16,
                        borderWidth: 1,
                        borderColor: "#e5e7eb",
                        borderRadius: 12,
                        padding: 14,
                        fontSize: 15,
                        color: "#1f2937",
                        minHeight: 100,
                        textAlignVertical: "top",
                      }}
                    />

                    {submitReport.isError && (
                      <Text style={{ color: "#ef4444", fontSize: 14, marginTop: 8 }}>
                        Failed to submit report. Please try again.
                      </Text>
                    )}

                    {/* Buttons */}
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 20, marginBottom: 20 }}>
                      <TouchableOpacity
                        onPress={handleClose}
                        style={{
                          flex: 1,
                          borderWidth: 1,
                          borderColor: "#e5e7eb",
                          borderRadius: 12,
                          padding: 14,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: "#6b7280", fontWeight: "600", fontSize: 16 }}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => submitReport.mutate()}
                        disabled={!canSubmit || submitReport.isPending}
                        style={{
                          flex: 1,
                          backgroundColor: canSubmit ? "#ef4444" : "#fca5a5",
                          borderRadius: 12,
                          padding: 14,
                          alignItems: "center",
                          opacity: submitReport.isPending ? 0.6 : 1,
                        }}
                      >
                        {submitReport.isPending ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                            Submit Report
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
