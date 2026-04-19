import type React from "react";
import {
  resolveUserTheme,
  themeResolverUserSelect,
  type ThemeResolverUser,
} from "@/lib/theme-resolver";

/**
 * Prisma select fragment for all user theme fields. Re-exported from the
 * resolver so callers only need one import.
 */
export const userThemeSelect = themeResolverUserSelect;

export type UserThemeData = ThemeResolverUser;

export interface SparklefallProps {
  sparkles: string | null;
  colors: string | null;
  interval: number | null;
  wind: number | null;
  maxSparkles: number | null;
  minSize: number | null;
  maxSize: number | null;
}

export interface UserThemeResult {
  hasCustomTheme: boolean;
  themeStyle: React.CSSProperties | undefined;
  bgImageStyle: React.CSSProperties | undefined;
  sparklefallProps: SparklefallProps | null;
}

export const NO_THEME: UserThemeResult = {
  hasCustomTheme: false,
  themeStyle: undefined,
  bgImageStyle: undefined,
  sparklefallProps: null,
};

/**
 * Web adapter over the platform-agnostic theme resolver: produces CSS
 * variables, background inline styles, and sparklefall props in the shape
 * the existing React components expect.
 */
export function buildUserTheme(user: UserThemeData): UserThemeResult {
  const resolved = resolveUserTheme(user);

  const themeStyle = resolved.hasCustomTheme
    ? ({
        "--profile-bg": resolved.colors.bg,
        "--profile-text": resolved.colors.text,
        "--profile-link": resolved.colors.link,
        "--profile-secondary": resolved.colors.secondary,
        "--profile-container": resolved.colors.container,
        "--profile-container-alpha": `${resolved.container.opacity}%`,
      } as React.CSSProperties)
    : undefined;

  const bgImageStyle: React.CSSProperties | undefined = resolved.background
    ? {
        backgroundImage: `url(${resolved.background.imageUrl})`,
        backgroundRepeat: resolved.background.repeat,
        backgroundAttachment: resolved.background.attachment,
        backgroundSize: resolved.background.size,
        backgroundPosition: resolved.background.position,
        minHeight: "calc(100vh - 57px)",
      }
    : undefined;

  const sparklefallProps: SparklefallProps | null = resolved.sparklefall
    ? {
        sparkles: JSON.stringify(resolved.sparklefall.sparkles),
        colors: resolved.sparklefall.colors.length
          ? JSON.stringify(resolved.sparklefall.colors)
          : null,
        interval: resolved.sparklefall.interval,
        wind: resolved.sparklefall.wind,
        maxSparkles: resolved.sparklefall.maxSparkles,
        minSize: resolved.sparklefall.minSize,
        maxSize: resolved.sparklefall.maxSize,
      }
    : null;

  return {
    hasCustomTheme: resolved.hasCustomTheme,
    themeStyle,
    bgImageStyle,
    sparklefallProps,
  };
}
