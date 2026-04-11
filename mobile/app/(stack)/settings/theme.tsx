import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

const THEME_KEY = "app_theme";

// react-native-mmkv crashes on web, so use localStorage as fallback
const storage =
  Platform.OS === "web"
    ? {
        getString: (key: string) =>
          typeof localStorage !== "undefined" ? localStorage.getItem(key) ?? undefined : undefined,
        set: (key: string, value: string) => {
          if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
        },
      }
    : (() => {
        const { MMKV } = require("react-native-mmkv");
        return new MMKV();
      })();

type ThemeOption = "light" | "dark" | "system";

function getStoredTheme(): ThemeOption {
  const stored = storage.getString(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

export default function ThemeScreen() {
  const systemScheme = useColorScheme();
  const [selected, setSelected] = useState<ThemeOption>(getStoredTheme);

  function selectTheme(theme: ThemeOption) {
    setSelected(theme);
    storage.set(THEME_KEY, theme);
  }

  const activeScheme = selected === "system" ? systemScheme : selected;

  const options: { value: ThemeOption; label: string; description: string }[] = [
    {
      value: "light",
      label: "Light",
      description: "Always use light appearance",
    },
    {
      value: "dark",
      label: "Dark",
      description: "Always use dark appearance",
    },
    {
      value: "system",
      label: "System",
      description: "Follow your device settings",
    },
  ];

  return (
    <>
      <Stack.Screen options={{ title: "Appearance" }} />
      <View style={{ flex: 1, backgroundColor: "#fff", padding: 16 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: "#9ca3af",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Theme
        </Text>

        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => selectTheme(option.value)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderWidth: 1,
                borderColor: isSelected ? "#c026d3" : "#e5e7eb",
                borderRadius: 12,
                marginBottom: 12,
                backgroundColor: isSelected ? "#fdf4ff" : "#fff",
              }}
            >
              {/* Radio indicator */}
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: isSelected ? "#c026d3" : "#d1d5db",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 14,
                }}
              >
                {isSelected && (
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: "#c026d3",
                    }}
                  />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#1f2937",
                  }}
                >
                  {option.label}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#6b7280",
                    marginTop: 2,
                  }}
                >
                  {option.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View
          style={{
            marginTop: 24,
            backgroundColor: "#f9fafb",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <Text style={{ color: "#6b7280", fontSize: 13 }}>
            Currently using{" "}
            <Text style={{ fontWeight: "600", color: "#374151" }}>
              {activeScheme === "dark" ? "dark" : "light"}
            </Text>{" "}
            mode.
            {selected === "system" &&
              " This follows your device's appearance setting."}
          </Text>
        </View>
      </View>
    </>
  );
}
