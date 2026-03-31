import type React from "react";
import { isBirthday, getBirthdaySparkleConfig } from "@/lib/birthday";

/**
 * Prisma select fragment for all user theme fields.
 * Spread into any `prisma.user.findUnique({ select: { ...userThemeSelect } })`.
 */
export const userThemeSelect = {
  id: true,
  tier: true,
  profileBgColor: true,
  profileTextColor: true,
  profileLinkColor: true,
  profileSecondaryColor: true,
  profileContainerColor: true,
  profileContainerOpacity: true,
  profileBgImage: true,
  profileBgRepeat: true,
  profileBgAttachment: true,
  profileBgSize: true,
  profileBgPosition: true,
  sparklefallEnabled: true,
  sparklefallSparkles: true,
  sparklefallColors: true,
  sparklefallInterval: true,
  sparklefallWind: true,
  sparklefallMaxSparkles: true,
  sparklefallMinSize: true,
  sparklefallMaxSize: true,
  birthdayMonth: true,
  birthdayDay: true,
} as const;

export type UserThemeData = {
  id: string;
  tier: string | null;
  profileBgColor: string | null;
  profileTextColor: string | null;
  profileLinkColor: string | null;
  profileSecondaryColor: string | null;
  profileContainerColor: string | null;
  profileContainerOpacity: number | null;
  profileBgImage: string | null;
  profileBgRepeat: string | null;
  profileBgAttachment: string | null;
  profileBgSize: string | null;
  profileBgPosition: string | null;
  sparklefallEnabled: boolean;
  sparklefallSparkles: string | null;
  sparklefallColors: string | null;
  sparklefallInterval: number | null;
  sparklefallWind: number | null;
  sparklefallMaxSparkles: number | null;
  sparklefallMinSize: number | null;
  sparklefallMaxSize: number | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
};

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
 * Build theme CSS variables, background image style, and sparklefall props.
 * Uses the user's chosen colors directly — no light/dark adaptation.
 */
export function buildUserTheme(user: UserThemeData): UserThemeResult {
  const hasCustomTheme = !!(
    user.profileBgColor ||
    user.profileTextColor ||
    user.profileLinkColor ||
    user.profileSecondaryColor ||
    user.profileContainerColor
  );

  const themeStyle = hasCustomTheme
    ? ({
        "--profile-bg": user.profileBgColor ?? "#ffffff",
        "--profile-text": user.profileTextColor ?? "#18181b",
        "--profile-link": user.profileLinkColor ?? "#2563eb",
        "--profile-secondary": user.profileSecondaryColor ?? "#71717a",
        "--profile-container": user.profileContainerColor ?? "#f4f4f5",
        "--profile-container-alpha": `${100 - (user.profileContainerOpacity ?? 0)}%`,
      } as React.CSSProperties)
    : undefined;

  const bgImageStyle: React.CSSProperties | undefined = user.profileBgImage
    ? {
        backgroundImage: `url(${user.profileBgImage})`,
        backgroundRepeat: user.profileBgRepeat ?? "no-repeat",
        backgroundAttachment: user.profileBgAttachment ?? "scroll",
        backgroundSize: user.profileBgSize ?? "cover",
        backgroundPosition: user.profileBgPosition ?? "center",
        minHeight: "calc(100vh - 57px)",
      }
    : undefined;

  let sparklefallProps: SparklefallProps | null = null;
  if (isBirthday(user.birthdayMonth, user.birthdayDay)) {
    sparklefallProps = getBirthdaySparkleConfig();
  } else if (user.sparklefallEnabled && user.tier === "premium") {
    sparklefallProps = {
      sparkles: user.sparklefallSparkles,
      colors: user.sparklefallColors,
      interval: user.sparklefallInterval,
      wind: user.sparklefallWind,
      maxSparkles: user.sparklefallMaxSparkles,
      minSize: user.sparklefallMinSize,
      maxSize: user.sparklefallMaxSize,
    };
  }

  return { hasCustomTheme, themeStyle, bgImageStyle, sparklefallProps };
}
