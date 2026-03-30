import type React from "react";
import { prisma } from "@/lib/prisma";
import { generateAdaptiveTheme } from "@/lib/profile-themes";
import { isBirthday, getBirthdaySparkleConfig } from "@/lib/birthday";

/**
 * Prisma select fragment for all user theme fields.
 * Spread into any `prisma.user.findUnique({ select: { ...userThemeSelect } })`.
 */
export const userThemeSelect = {
  id: true,
  tier: true,
  isBeta: true,
  profileBgColor: true,
  profileTextColor: true,
  profileLinkColor: true,
  profileSecondaryColor: true,
  profileContainerColor: true,
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
  isBeta: boolean;
  profileBgColor: string | null;
  profileTextColor: string | null;
  profileLinkColor: string | null;
  profileSecondaryColor: string | null;
  profileContainerColor: string | null;
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

/**
 * Build theme CSS variables, background image style, and sparklefall props
 * for the current user. Mirrors the logic from the profile page.
 */
export const NO_THEME: UserThemeResult = {
  hasCustomTheme: false,
  themeStyle: undefined,
  bgImageStyle: undefined,
  sparklefallProps: null,
};

export async function buildUserTheme(user: UserThemeData): Promise<UserThemeResult> {
  // Page-level theming is currently beta-gated
  if (!user.isBeta) return NO_THEME;

  const hasCustomTheme = !!(
    user.profileBgColor ||
    user.profileTextColor ||
    user.profileLinkColor ||
    user.profileSecondaryColor ||
    user.profileContainerColor
  );

  const themeStyle = hasCustomTheme
    ? await (async () => {
        const userColors = {
          profileBgColor: user.profileBgColor ?? "#ffffff",
          profileTextColor: user.profileTextColor ?? "#18181b",
          profileLinkColor: user.profileLinkColor ?? "#2563eb",
          profileSecondaryColor: user.profileSecondaryColor ?? "#71717a",
          profileContainerColor: user.profileContainerColor ?? "#f4f4f5",
        };

        let customPreset: {
          darkBgColor: string;
          darkTextColor: string;
          darkLinkColor: string;
          darkSecondaryColor: string;
          darkContainerColor: string;
        } | null = null;
        try {
          customPreset = await prisma.customThemePreset.findFirst({
            where: {
              userId: user.id,
              lightBgColor: userColors.profileBgColor,
              lightTextColor: userColors.profileTextColor,
              lightLinkColor: userColors.profileLinkColor,
              lightSecondaryColor: userColors.profileSecondaryColor,
              lightContainerColor: userColors.profileContainerColor,
            },
          });
        } catch {
          // Table may not exist yet during migration rollout
        }

        let light = userColors;
        let dark;
        if (customPreset) {
          dark = {
            profileBgColor: customPreset.darkBgColor,
            profileTextColor: customPreset.darkTextColor,
            profileLinkColor: customPreset.darkLinkColor,
            profileSecondaryColor: customPreset.darkSecondaryColor,
            profileContainerColor: customPreset.darkContainerColor,
          };
        } else {
          const adaptive = generateAdaptiveTheme(userColors);
          light = adaptive.light;
          dark = adaptive.dark;
        }

        return {
          "--profile-bg-light": light.profileBgColor,
          "--profile-text-light": light.profileTextColor,
          "--profile-link-light": light.profileLinkColor,
          "--profile-secondary-light": light.profileSecondaryColor,
          "--profile-container-light": light.profileContainerColor,
          "--profile-bg-dark": dark.profileBgColor,
          "--profile-text-dark": dark.profileTextColor,
          "--profile-link-dark": dark.profileLinkColor,
          "--profile-secondary-dark": dark.profileSecondaryColor,
          "--profile-container-dark": dark.profileContainerColor,
        } as React.CSSProperties;
      })()
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
