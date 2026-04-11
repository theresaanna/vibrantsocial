/**
 * ThemedView — Wrapper component that applies a user's theme to a View.
 * Provides theme colors to children via React context.
 */

import { createContext, useContext, useMemo } from "react";
import { View, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import {
  type UserThemeColors,
  type UserThemeData,
  getThemeStyles,
  hexToRgba,
  resolveImageUrl,
  DEFAULT_THEME_COLORS,
} from "@/lib/user-theme";

// ── Context ─────────────────────────────────────────────────────────

const UserThemeContext = createContext<UserThemeColors>(DEFAULT_THEME_COLORS);

/**
 * Hook to access the current user theme colors from any child component.
 */
export function useUserTheme(): UserThemeColors {
  return useContext(UserThemeContext);
}

// ── Component ───────────────────────────────────────────────────────

interface ThemedViewProps {
  themeData?: Partial<UserThemeData> | null;
  /** Direct theme colors (alternative to themeData). */
  themeColors?: UserThemeColors | null;
  children: React.ReactNode;
  style?: ViewStyle;
  /** When true, show background image behind content. */
  showBgImage?: boolean;
}

export function ThemedView({
  themeData,
  themeColors: directColors,
  children,
  style,
  showBgImage = true,
}: ThemedViewProps) {
  const colors = useMemo(() => {
    if (directColors) return directColors;
    return getThemeStyles(themeData);
  }, [themeData, directColors]);

  const bgImageUrl = resolveImageUrl(colors.bgImageUrl);

  return (
    <UserThemeContext.Provider value={colors}>
      <View
        style={[
          {
            flex: 1,
            backgroundColor: colors.backgroundColor,
          },
          style,
        ]}
      >
        {showBgImage && bgImageUrl && (
          <Image
            source={{ uri: bgImageUrl }}
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
        {children}
      </View>
    </UserThemeContext.Provider>
  );
}

// ── Themed Container ────────────────────────────────────────────────

interface ThemedContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * A container view that uses the theme's container color with opacity.
 * Use inside a ThemedView for post cards, profile sections, etc.
 */
export function ThemedContainer({ children, style }: ThemedContainerProps) {
  const theme = useUserTheme();

  return (
    <View
      style={[
        {
          backgroundColor: hexToRgba(
            theme.containerColor,
            theme.containerOpacity,
          ),
          borderRadius: 12,
          padding: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
