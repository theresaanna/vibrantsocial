/**
 * Theme Editor Screen — Full theme customization for the user's profile.
 * Includes live preview, 5 color pickers, preset theme selector,
 * container opacity slider, background image picker, and save.
 */

import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Stack, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ColorPicker } from "@/components/color-picker";
import {
  type ProfileThemeColors,
  type UserThemeData,
  PROFILE_THEME_PRESETS,
  THEME_COLOR_FIELDS,
  getThemeStyles,
  hexToRgba,
  resolveImageUrl,
} from "@/lib/user-theme";

// ── Types ───────────────────────────────────────────────────────────

interface ThemeData {
  profileBgColor: string | null;
  profileTextColor: string | null;
  profileLinkColor: string | null;
  profileSecondaryColor: string | null;
  profileContainerColor: string | null;
  profileContainerOpacity: number | null;
  profileBgImage: string | null;
  profileBgRepeat: string | null;
  profileBgSize: string | null;
  profileBgPosition: string | null;
  displayName: string | null;
  username: string;
  avatar: string | null;
}

interface BackgroundPreset {
  id: string;
  name: string;
  src: string;
  thumbSrc: string;
  category: string;
}

// ── Preset names for display ────────────────────────────────────────

const PRESET_NAMES: Record<string, string> = {
  default: "Default",
  ocean: "Ocean",
  forest: "Forest",
  sunset: "Sunset",
  midnight: "Midnight",
  rose: "Rose",
  lavender: "Lavender",
  sky: "Sky",
  mint: "Mint",
  peach: "Peach",
  terracotta: "Terracotta",
  amber: "Amber",
  cinnamon: "Cinnamon",
  stone: "Stone",
  slate: "Slate",
  sand: "Sand",
  charcoal: "Charcoal",
  ash: "Ash",
  graphite: "Graphite",
};

// ── Component ───────────────────────────────────────────────────────

export default function ThemeEditorScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch current theme
  const { data: themeData, isLoading } = useQuery({
    queryKey: ["userTheme", user?.id],
    queryFn: () => api.rpc<ThemeData>("getUserTheme"),
    enabled: !!user,
  });

  // Fetch background presets
  const { data: backgrounds } = useQuery({
    queryKey: ["backgroundPresets"],
    queryFn: () => api.rpc<BackgroundPreset[]>("getBackgroundPresets"),
  });

  // Local editing state
  const defaultPreset = PROFILE_THEME_PRESETS.default;
  const [colors, setColors] = useState<ProfileThemeColors | null>(null);
  const [containerOpacity, setContainerOpacity] = useState<number>(100);
  const [selectedBgImage, setSelectedBgImage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize from server data
  if (themeData && !initialized) {
    setColors({
      profileBgColor: themeData.profileBgColor ?? defaultPreset.profileBgColor,
      profileTextColor: themeData.profileTextColor ?? defaultPreset.profileTextColor,
      profileLinkColor: themeData.profileLinkColor ?? defaultPreset.profileLinkColor,
      profileSecondaryColor: themeData.profileSecondaryColor ?? defaultPreset.profileSecondaryColor,
      profileContainerColor: themeData.profileContainerColor ?? defaultPreset.profileContainerColor,
    });
    setContainerOpacity(themeData.profileContainerOpacity ?? 100);
    setSelectedBgImage(themeData.profileBgImage);
    setInitialized(true);
  }

  const currentColors = colors ?? defaultPreset;

  // Active preset detection
  const activePreset = useMemo(() => {
    for (const [key, preset] of Object.entries(PROFILE_THEME_PRESETS)) {
      if (
        THEME_COLOR_FIELDS.every(
          (f) => currentColors[f] === preset[f],
        )
      ) {
        return key;
      }
    }
    return null;
  }, [currentColors]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      api.rpc("saveTheme", {
        ...currentColors,
        profileContainerOpacity: containerOpacity,
        profileBgImage: selectedBgImage,
      }),
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["userTheme"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      Alert.alert("Saved", "Your theme has been updated.");
    },
    onError: () => {
      Alert.alert("Error", "Failed to save theme. Please try again.");
    },
  });

  const handleColorChange = useCallback(
    (field: keyof ProfileThemeColors, value: string) => {
      setColors((prev) => ({
        ...(prev ?? defaultPreset),
        [field]: value,
      }));
    },
    [defaultPreset],
  );

  const handlePresetSelect = useCallback((presetKey: string) => {
    const preset = PROFILE_THEME_PRESETS[presetKey];
    if (preset) {
      setColors({ ...preset });
    }
  }, []);

  const handleBgSelect = useCallback((src: string | null) => {
    setSelectedBgImage((prev) => (prev === src ? null : src));
  }, []);

  if (isLoading || !initialized) {
    return (
      <>
        <Stack.Screen options={{ title: "Theme & Style" }} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#c026d3" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Theme & Style" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Live Preview */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", marginBottom: 12 }}>
            Preview
          </Text>
          <View
            style={{
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: "#e5e7eb",
            }}
          >
            {/* Profile mockup */}
            <View style={{ backgroundColor: currentColors.profileBgColor, padding: 16 }}>
              {selectedBgImage && (
                <Image
                  source={{ uri: resolveImageUrl(selectedBgImage) ?? undefined }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                  contentFit="cover"
                />
              )}
              <View
                style={{
                  backgroundColor: hexToRgba(currentColors.profileContainerColor, containerOpacity),
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: currentColors.profileSecondaryColor,
                      opacity: 0.3,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "700", fontSize: 14, color: currentColors.profileTextColor }}>
                      {themeData?.displayName || themeData?.username || "Your Name"}
                    </Text>
                    <Text style={{ fontSize: 12, color: currentColors.profileSecondaryColor }}>
                      @{themeData?.username || "username"}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: currentColors.profileSecondaryColor, marginTop: 8 }}>
                  This is what your bio will look like with these colors.
                </Text>
                <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                  <Text style={{ fontSize: 11, color: currentColors.profileSecondaryColor }}>
                    <Text style={{ fontWeight: "700", color: currentColors.profileTextColor }}>42</Text> posts
                  </Text>
                  <Text style={{ fontSize: 11, color: currentColors.profileSecondaryColor }}>
                    <Text style={{ fontWeight: "700", color: currentColors.profileTextColor }}>128</Text> followers
                  </Text>
                </View>
              </View>

              {/* Sample post preview */}
              <View
                style={{
                  backgroundColor: hexToRgba(currentColors.profileContainerColor, containerOpacity),
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: currentColors.profileTextColor }}>
                  Just posted something cool! Check out{" "}
                  <Text style={{ color: currentColors.profileLinkColor }}>this link</Text>{" "}
                  for more details.
                </Text>
                <Text style={{ fontSize: 10, color: currentColors.profileSecondaryColor, marginTop: 4 }}>
                  2 hours ago
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Preset Themes */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", marginBottom: 12 }}>
            Preset Themes
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {Object.entries(PROFILE_THEME_PRESETS).map(([key, preset]) => {
                const isActive = activePreset === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handlePresetSelect(key)}
                    style={{
                      width: 80,
                      borderRadius: 12,
                      overflow: "hidden",
                      borderWidth: isActive ? 2 : 1,
                      borderColor: isActive ? "#c026d3" : "#e5e7eb",
                    }}
                  >
                    {/* Mini color preview */}
                    <View style={{ backgroundColor: preset.profileBgColor, padding: 6 }}>
                      <View
                        style={{
                          backgroundColor: preset.profileContainerColor,
                          borderRadius: 4,
                          padding: 4,
                          height: 32,
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 3,
                            borderRadius: 1.5,
                            backgroundColor: preset.profileTextColor,
                            marginBottom: 3,
                          }}
                        />
                        <View
                          style={{
                            width: 16,
                            height: 3,
                            borderRadius: 1.5,
                            backgroundColor: preset.profileLinkColor,
                          }}
                        />
                      </View>
                    </View>
                    <Text
                      style={{
                        fontSize: 10,
                        textAlign: "center",
                        paddingVertical: 4,
                        color: isActive ? "#c026d3" : "#6b7280",
                        fontWeight: isActive ? "700" : "500",
                      }}
                      numberOfLines={1}
                    >
                      {PRESET_NAMES[key] ?? key}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Color Pickers */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", marginBottom: 12 }}>
            Colors
          </Text>
          <View style={{ gap: 6 }}>
            <ColorPicker
              label="Background"
              value={currentColors.profileBgColor}
              onChange={(c) => handleColorChange("profileBgColor", c)}
            />
            <ColorPicker
              label="Text"
              value={currentColors.profileTextColor}
              onChange={(c) => handleColorChange("profileTextColor", c)}
            />
            <ColorPicker
              label="Links"
              value={currentColors.profileLinkColor}
              onChange={(c) => handleColorChange("profileLinkColor", c)}
            />
            <ColorPicker
              label="Secondary"
              value={currentColors.profileSecondaryColor}
              onChange={(c) => handleColorChange("profileSecondaryColor", c)}
            />
            <ColorPicker
              label="Container"
              value={currentColors.profileContainerColor}
              onChange={(c) => handleColorChange("profileContainerColor", c)}
            />
          </View>
        </View>

        {/* Container Opacity */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", marginBottom: 12 }}>
            Container Opacity
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity
              onPress={() => setContainerOpacity(Math.max(80, containerOpacity - 1))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#f3f4f6",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#6b7280" }}>-</Text>
            </TouchableOpacity>

            {/* Visual bar */}
            <View style={{ flex: 1, height: 8, backgroundColor: "#e5e7eb", borderRadius: 4 }}>
              <View
                style={{
                  width: `${((containerOpacity - 80) / 20) * 100}%`,
                  height: "100%",
                  backgroundColor: "#c026d3",
                  borderRadius: 4,
                }}
              />
            </View>

            <TouchableOpacity
              onPress={() => setContainerOpacity(Math.min(100, containerOpacity + 1))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "#f3f4f6",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#6b7280" }}>+</Text>
            </TouchableOpacity>

            <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151", width: 40, textAlign: "right" }}>
              {containerOpacity}%
            </Text>
          </View>
        </View>

        {/* Background Image Picker */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#9ca3af", textTransform: "uppercase", marginBottom: 12 }}>
            Background Image
          </Text>

          {/* None option */}
          <TouchableOpacity
            onPress={() => handleBgSelect(null)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: !selectedBgImage ? "#c026d3" : "#e5e7eb",
              backgroundColor: !selectedBgImage ? "#fdf4ff" : "#fff",
              marginBottom: 12,
            }}
          >
            <Text style={{ color: !selectedBgImage ? "#c026d3" : "#6b7280", fontWeight: "600", fontSize: 14 }}>
              No Background
            </Text>
          </TouchableOpacity>

          {backgrounds && backgrounds.length > 0 && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {backgrounds.map((bg) => {
                const isSelected = selectedBgImage === bg.src;
                return (
                  <TouchableOpacity
                    key={bg.id}
                    onPress={() => handleBgSelect(bg.src)}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 10,
                      overflow: "hidden",
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? "#c026d3" : "#e5e7eb",
                    }}
                  >
                    <Image
                      source={{ uri: resolveImageUrl(bg.thumbSrc) ?? undefined }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Save Button */}
        <View style={{ paddingHorizontal: 16 }}>
          <TouchableOpacity
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={{
              backgroundColor: "#c026d3",
              borderRadius: 12,
              paddingVertical: 16,
              alignItems: "center",
              opacity: saveMutation.isPending ? 0.6 : 1,
            }}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                Save Theme
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );
}
