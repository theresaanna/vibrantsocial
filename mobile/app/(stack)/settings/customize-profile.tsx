import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { FramedAvatar, PROFILE_FRAMES, type FrameDefinition } from "@/components/framed-avatar";
import { StyledName, USERNAME_FONTS, type FontDefinition } from "@/components/styled-name";
import { SPARKLEFALL_PRESETS } from "@/components/sparklefall";

interface ProfileCustomization {
  profileFrameId: string | null;
  profileFontId: string | null;
  sparklefallEnabled: boolean;
  sparklefallPreset: string | null;
  profileBgColor: string | null;
  avatar: string | null;
  displayName: string | null;
  username: string;
}

const BG_COLORS = [
  { id: null, label: "None", color: "#ffffff" },
  { id: "pink", label: "Pink", color: "#fdf2f8" },
  { id: "purple", label: "Purple", color: "#faf5ff" },
  { id: "blue", label: "Blue", color: "#eff6ff" },
  { id: "green", label: "Green", color: "#f0fdf4" },
  { id: "amber", label: "Amber", color: "#fffbeb" },
  { id: "rose", label: "Rose", color: "#fff1f2" },
  { id: "cyan", label: "Cyan", color: "#ecfeff" },
  { id: "slate", label: "Slate", color: "#f8fafc" },
];

export default function CustomizeProfileScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profileCustomization", user?.id],
    queryFn: () => api.rpc<ProfileCustomization>("getProfileCustomization"),
    enabled: !!user,
  });

  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [selectedFontId, setSelectedFontId] = useState<string | null>(null);
  const [sparklefallEnabled, setSparklefallEnabled] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [selectedBgColor, setSelectedBgColor] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Sync state from server data once loaded
  if (profile && !initialized) {
    setSelectedFrameId(profile.profileFrameId);
    setSelectedFontId(profile.profileFontId);
    setSparklefallEnabled(profile.sparklefallEnabled);
    setSelectedPreset(profile.sparklefallPreset);
    setSelectedBgColor(profile.profileBgColor);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      api.rpc("updateProfileCustomization", {
        profileFrameId: selectedFrameId,
        profileFontId: selectedFontId,
        sparklefallEnabled,
        sparklefallPreset: selectedPreset,
        profileBgColor: selectedBgColor,
      }),
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profileCustomization"] });
      Alert.alert("Saved", "Your profile has been customized.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save");
    },
  });

  if (isLoading || !profile) {
    return (
      <>
        <Stack.Screen options={{ title: "Customize Profile" }} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#c026d3" />
        </View>
      </>
    );
  }

  const frameCategories: { label: string; category: FrameDefinition["category"] }[] = [
    { label: "Spring", category: "spring" },
    { label: "Neon", category: "neon" },
    { label: "Decorative", category: "decorative" },
    { label: "Floral", category: "floral" },
    { label: "Whimsy", category: "whimsy" },
  ];

  return (
    <>
      <Stack.Screen options={{ title: "Customize Profile" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Preview */}
        <View
          style={{
            alignItems: "center",
            paddingVertical: 24,
            backgroundColor: selectedBgColor
              ? BG_COLORS.find((c) => c.id === selectedBgColor)?.color ?? "#fff"
              : "#fff",
          }}
        >
          <FramedAvatar
            uri={profile.avatar}
            size={100}
            frameId={selectedFrameId}
          />
          <View style={{ marginTop: 12 }}>
            <StyledName
              fontId={selectedFontId}
              style={{ fontSize: 20, fontWeight: "700", textAlign: "center" }}
            >
              {profile.displayName || profile.username}
            </StyledName>
          </View>
          <Text style={{ color: "#9ca3af", fontSize: 14, marginTop: 2 }}>
            @{profile.username}
          </Text>
        </View>

        {/* Frame Picker */}
        <SectionHeader title="Avatar Frame" />
        <View style={{ paddingHorizontal: 16 }}>
          {/* None option */}
          <TouchableOpacity
            onPress={() => setSelectedFrameId(null)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: selectedFrameId === null ? "#c026d3" : "#e5e7eb",
              backgroundColor: selectedFrameId === null ? "#fdf4ff" : "#f9fafb",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontWeight: "600",
                color: selectedFrameId === null ? "#c026d3" : "#6b7280",
                textAlign: "center",
              }}
            >
              No Frame
            </Text>
          </TouchableOpacity>

          {frameCategories.map(({ label, category }) => {
            const frames = PROFILE_FRAMES.filter((f) => f.category === category);
            return (
              <View key={category} style={{ marginBottom: 16 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    marginBottom: 8,
                  }}
                >
                  {label}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {frames.map((frame) => (
                      <TouchableOpacity
                        key={frame.id}
                        onPress={() => setSelectedFrameId(frame.id)}
                        style={{
                          alignItems: "center",
                          padding: 6,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor:
                            selectedFrameId === frame.id ? "#c026d3" : "transparent",
                          backgroundColor:
                            selectedFrameId === frame.id ? "#fdf4ff" : "transparent",
                        }}
                      >
                        <FramedAvatar
                          uri={profile.avatar}
                          size={64}
                          frameId={frame.id}
                        />
                        <Text
                          style={{
                            fontSize: 10,
                            color: "#6b7280",
                            marginTop: 4,
                            maxWidth: 70,
                            textAlign: "center",
                          }}
                          numberOfLines={1}
                        >
                          {frame.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            );
          })}
        </View>

        {/* Font Picker */}
        <SectionHeader title="Display Name Font" />
        <View style={{ paddingHorizontal: 16 }}>
          <TouchableOpacity
            onPress={() => setSelectedFontId(null)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: selectedFontId === null ? "#c026d3" : "#e5e7eb",
              backgroundColor: selectedFontId === null ? "#fdf4ff" : "#f9fafb",
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontWeight: "600",
                color: selectedFontId === null ? "#c026d3" : "#6b7280",
                textAlign: "center",
              }}
            >
              Default
            </Text>
          </TouchableOpacity>

          {/* Free fonts */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            Free
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {USERNAME_FONTS.filter((f) => f.tier === "free").map((font) => (
              <FontOption
                key={font.id}
                font={font}
                isSelected={selectedFontId === font.id}
                displayName={profile.displayName || profile.username}
                onSelect={() => setSelectedFontId(font.id)}
              />
            ))}
          </View>

          {/* Premium fonts */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: "#9ca3af",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            Premium
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {USERNAME_FONTS.filter((f) => f.tier === "premium").map((font) => (
              <FontOption
                key={font.id}
                font={font}
                isSelected={selectedFontId === font.id}
                displayName={profile.displayName || profile.username}
                onSelect={() => setSelectedFontId(font.id)}
              />
            ))}
          </View>
        </View>

        {/* Sparkle Effect */}
        <SectionHeader title="Raining Emoji" />
        <View style={{ paddingHorizontal: 16 }}>
          <TouchableOpacity
            onPress={() => setSparklefallEnabled(!sparklefallEnabled)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: sparklefallEnabled ? "#c026d3" : "#d1d5db",
                backgroundColor: sparklefallEnabled ? "#c026d3" : "#fff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {sparklefallEnabled && (
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 16 }}>
                  {"\u2713"}
                </Text>
              )}
            </View>
            <Text style={{ fontSize: 15, color: "#374151" }}>
              Enable raining emoji on your profile
            </Text>
          </TouchableOpacity>

          {sparklefallEnabled && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(SPARKLEFALL_PRESETS).map(([name, preset]) => (
                <TouchableOpacity
                  key={name}
                  onPress={() => setSelectedPreset(name)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 2,
                    borderColor: selectedPreset === name ? "#c026d3" : "#e5e7eb",
                    backgroundColor: selectedPreset === name ? "#fdf4ff" : "#f9fafb",
                  }}
                >
                  <Text style={{ fontSize: 14 }}>
                    {preset.emoji} {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Background Color */}
        <SectionHeader title="Profile Background" />
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {BG_COLORS.map((bg) => (
              <TouchableOpacity
                key={bg.id ?? "none"}
                onPress={() => setSelectedBgColor(bg.id)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: bg.color,
                  borderWidth: 2,
                  borderColor: selectedBgColor === bg.id ? "#c026d3" : "#e5e7eb",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {bg.id === null && (
                  <Text style={{ fontSize: 10, color: "#9ca3af" }}>None</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <View style={{ paddingHorizontal: 16 }}>
          <TouchableOpacity
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={{
              backgroundColor: "#c026d3",
              borderRadius: 12,
              padding: 16,
              alignItems: "center",
              opacity: saveMutation.isPending ? 0.6 : 1,
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
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 24,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: "#f3f4f6",
        marginTop: 8,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: "700", color: "#1f2937" }}>
        {title}
      </Text>
    </View>
  );
}

function FontOption({
  font,
  isSelected,
  displayName,
  onSelect,
}: {
  font: FontDefinition;
  isSelected: boolean;
  displayName: string;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: isSelected ? "#c026d3" : "#e5e7eb",
        backgroundColor: isSelected ? "#fdf4ff" : "#f9fafb",
        minWidth: "45%",
        flexGrow: 1,
      }}
    >
      <StyledName
        fontId={font.id}
        style={{
          fontSize: 14,
          color: "#1f2937",
          textAlign: "center",
        }}
      >
        {font.name}
      </StyledName>
    </TouchableOpacity>
  );
}
