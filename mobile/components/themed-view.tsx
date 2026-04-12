/**
 * ThemedView — Wrapper component that applies a user's theme to a View.
 * Provides theme colors to children via React context.
 */

import { createContext, useContext, useMemo } from "react";
import { Image as RNImage, View, type ViewStyle } from "react-native";
import { Image, type ImageContentFit, type ImageContentPosition } from "expo-image";
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

// ── Background helpers ─────────────────────────────────────────────

/**
 * Maps CSS background-size values to expo-image contentFit.
 * CSS values: "cover" | "contain" | "auto" | "100% 100%"
 */
function mapBgSizeToContentFit(bgSize: string | null): ImageContentFit {
  if (!bgSize) return "cover";
  switch (bgSize) {
    case "cover":
      return "cover";
    case "contain":
      return "contain";
    case "100% 100%":
      return "fill"; // stretch to fill
    case "auto":
      return "none"; // natural size, no scaling
    default:
      return "cover";
  }
}

/**
 * Maps CSS background-position values to expo-image contentPosition.
 * CSS values like "center", "top", "bottom left", "top right", etc.
 */
function mapBgPositionToContentPosition(bgPosition: string | null): ImageContentPosition {
  if (!bgPosition) return "center";
  // expo-image accepts the same CSS-like position strings
  return bgPosition as ImageContentPosition;
}

// ── Background Image Component ─────────────────────────────────────

interface ThemeBackgroundProps {
  colors: UserThemeColors;
}

/**
 * Renders the theme background image with proper size, position, and repeat.
 * Renders as an absolutely-positioned layer behind content.
 * Uses RN's built-in Image for repeat mode (expo-image doesn't support it).
 */
function ThemeBackground({ colors }: ThemeBackgroundProps) {
  const bgImageUrl = resolveImageUrl(colors.bgImageUrl);
  if (!bgImageUrl) return null;

  const shouldRepeat = colors.bgRepeat === "repeat" || colors.bgRepeat === "repeat-x" || colors.bgRepeat === "repeat-y";

  const absStyle = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  // Use React Native's built-in Image for repeat (expo-image doesn't support it)
  if (shouldRepeat) {
    return (
      <RNImage
        source={{ uri: bgImageUrl }}
        style={absStyle}
        resizeMode="repeat"
      />
    );
  }

  // Non-repeating: use expo-image for better contentFit/contentPosition support
  const contentFit = mapBgSizeToContentFit(colors.bgSize);
  const contentPosition = mapBgPositionToContentPosition(colors.bgPosition);

  return (
    <Image
      source={{ uri: bgImageUrl }}
      style={absStyle}
      contentFit={contentFit}
      contentPosition={contentPosition}
    />
  );
}

/**
 * Standalone background component for use inside individual screens.
 * Reads from the theme context — must be inside a ThemedView or UserThemeContext.Provider.
 */
export function ScreenBackground() {
  const theme = useUserTheme();
  return <ThemeBackground colors={theme} />;
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
        {showBgImage && <ThemeBackground colors={colors} />}
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
