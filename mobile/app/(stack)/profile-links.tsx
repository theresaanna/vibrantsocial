import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface LinkEntry {
  id: string;
  title: string;
  url: string;
}

interface ProfileLinksData {
  linksPageEnabled: boolean;
  linksPageBio: string | null;
  linksPageSensitiveLinks: boolean;
  linksPageLinks: LinkEntry[];
}

export default function ProfileLinksScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["profileLinks"],
    queryFn: () => api.rpc<ProfileLinksData>("getProfileLinks"),
  });

  const [links, setLinks] = useState<LinkEntry[] | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);

  // Initialize from server data
  const currentLinks = links ?? data?.linksPageLinks ?? [];
  const currentBio = bio ?? data?.linksPageBio ?? "";
  const currentEnabled = enabled ?? data?.linksPageEnabled ?? false;

  const saveMutation = useMutation({
    mutationFn: () =>
      api.rpc("updateProfileLinks", {
        enabled: currentEnabled,
        bio: currentBio,
        sensitiveLinks: data?.linksPageSensitiveLinks ?? false,
        links: currentLinks
          .filter((l) => l.title.trim() && l.url.trim())
          .map((l) => ({ title: l.title.trim(), url: l.url.trim() })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profileLinks"] });
      Alert.alert("Saved", "Your links page has been updated.");
    },
    onError: () => {
      Alert.alert("Error", "Failed to save links. Please try again.");
    },
  });

  const addLink = useCallback(() => {
    const newLinks = [...currentLinks, { id: Date.now().toString(), title: "", url: "" }];
    setLinks(newLinks);
  }, [currentLinks]);

  const removeLink = useCallback(
    (id: string) => {
      setLinks(currentLinks.filter((l) => l.id !== id));
    },
    [currentLinks]
  );

  const updateLink = useCallback(
    (id: string, field: "title" | "url", value: string) => {
      setLinks(currentLinks.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
    },
    [currentLinks]
  );

  const moveLink = useCallback(
    (index: number, direction: "up" | "down") => {
      const newLinks = [...currentLinks];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newLinks.length) return;
      [newLinks[index], newLinks[targetIndex]] = [newLinks[targetIndex], newLinks[index]];
      setLinks(newLinks);
    },
    [currentLinks]
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#c026d3" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* Enable toggle */}
        <TouchableOpacity
          onPress={() => setEnabled(!currentEnabled)}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#f3f4f6",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#1f2937" }}>
              Enable Links Page
            </Text>
            <Text style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
              Share a page with all your important links
            </Text>
          </View>
          <View
            style={{
              width: 48,
              height: 28,
              borderRadius: 14,
              backgroundColor: currentEnabled ? "#c026d3" : "#d1d5db",
              justifyContent: "center",
              padding: 2,
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "#fff",
                alignSelf: currentEnabled ? "flex-end" : "flex-start",
              }}
            />
          </View>
        </TouchableOpacity>

        {/* Bio */}
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>
            Bio
          </Text>
          <TextInput
            placeholder="A short bio for your links page..."
            value={currentBio}
            onChangeText={(text) => setBio(text)}
            multiline
            maxLength={300}
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: 12,
              padding: 12,
              fontSize: 15,
              minHeight: 60,
              textAlignVertical: "top",
            }}
          />
        </View>

        {/* Links */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", marginBottom: 12 }}>
            Links
          </Text>

          {currentLinks.map((link, index) => (
            <View
              key={link.id}
              style={{
                backgroundColor: "#f9fafb",
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#e5e7eb",
              }}
            >
              <TextInput
                placeholder="Link title"
                value={link.title}
                onChangeText={(text) => updateLink(link.id, "title", text)}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 15,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                }}
              />
              <TextInput
                placeholder="https://..."
                value={link.url}
                onChangeText={(text) => updateLink(link.id, "url", text)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  padding: 10,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                }}
              />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 8, gap: 8 }}>
                {index > 0 && (
                  <TouchableOpacity
                    onPress={() => moveLink(index, "up")}
                    style={{
                      backgroundColor: "#e5e7eb",
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: "#6b7280" }}>Move Up</Text>
                  </TouchableOpacity>
                )}
                {index < currentLinks.length - 1 && (
                  <TouchableOpacity
                    onPress={() => moveLink(index, "down")}
                    style={{
                      backgroundColor: "#e5e7eb",
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: "#6b7280" }}>Move Down</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => removeLink(link.id)}
                  style={{
                    backgroundColor: "#fef2f2",
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 14, color: "#ef4444" }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            onPress={addLink}
            style={{
              borderWidth: 2,
              borderColor: "#e5e7eb",
              borderStyle: "dashed",
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#c026d3", fontWeight: "600", fontSize: 15 }}>
              + Add Link
            </Text>
          </TouchableOpacity>
        </View>

        {/* Save button */}
        <View style={{ padding: 16, paddingBottom: 40 }}>
          <TouchableOpacity
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={{
              backgroundColor: "#c026d3",
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
            }}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>
                Save Changes
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
