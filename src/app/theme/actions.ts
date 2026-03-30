"use server";

import { auth } from "@/auth";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { isValidHexColor, THEME_COLOR_FIELDS, isPresetTheme } from "@/lib/profile-themes";
import { isValidPreset, parseJsonArray, clamp } from "@/lib/sparklefall-presets";
import { isValidFontId, getFontById } from "@/lib/profile-fonts";
import { checkAndExpirePremium } from "@/lib/premium";
import { isValidBgRepeat, isValidBgAttachment, isValidBgSize, isValidBgPosition } from "@/lib/profile-backgrounds";
import { isPresetBackgroundSrc } from "@/lib/profile-backgrounds.server";
import { invalidate, cacheKeys } from "@/lib/cache";

interface ThemeState {
  success: boolean;
  message: string;
}

export async function updateTheme(
  _prevState: ThemeState,
  formData: FormData
): Promise<ThemeState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `theme:${session.user.id}`)) {
    return { success: false, message: "Too many requests. Please try again later." };
  }

  const isPremium = await checkAndExpirePremium(session.user.id);

  // Validate theme colors
  const themeColors: Record<string, string | null> = {};
  for (const field of THEME_COLOR_FIELDS) {
    const value = formData.get(field) as string | null;
    if (value && value.trim()) {
      if (!isValidHexColor(value.trim())) {
        return {
          success: false,
          message: `Invalid color value for ${field}. Must be a valid hex color (e.g. #ff0000).`,
        };
      }
      themeColors[field] = value.trim();
    } else {
      themeColors[field] = null;
    }
  }

  // Non-premium users can only use preset themes, not custom colors
  if (!isPremium && !isPresetTheme(themeColors)) {
    for (const field of THEME_COLOR_FIELDS) {
      themeColors[field] = null;
    }
  }

  // Validate username font
  const rawFontId = formData.get("usernameFont") as string | null;
  let usernameFont: string | null = null;
  if (rawFontId && rawFontId.trim()) {
    if (!isValidFontId(rawFontId.trim())) {
      return { success: false, message: "Invalid font selection." };
    }
    const font = getFontById(rawFontId.trim());
    if (font && font.tier === "premium" && !isPremium) {
      usernameFont = null;
    } else {
      usernameFont = rawFontId.trim();
    }
  }

  // Validate profile background
  const rawBgImage = (formData.get("profileBgImage") as string)?.trim() || null;
  const rawBgRepeat = (formData.get("profileBgRepeat") as string)?.trim() || null;
  const rawBgAttachment = (formData.get("profileBgAttachment") as string)?.trim() || null;
  const rawBgSize = (formData.get("profileBgSize") as string)?.trim() || null;
  const rawBgPosition = (formData.get("profileBgPosition") as string)?.trim() || null;

  const bgData: Record<string, string | null> = {
    profileBgImage: null,
    profileBgRepeat: null,
    profileBgAttachment: null,
    profileBgSize: null,
    profileBgPosition: null,
  };

  if (rawBgImage) {
    const isPreset = isPresetBackgroundSrc(rawBgImage);
    const isBlobUrl = rawBgImage.includes("blob.vercel-storage.com");

    if (!isPreset && !isBlobUrl) {
      return { success: false, message: "Invalid background image." };
    }

    if (!isPremium && !isPreset) {
      bgData.profileBgImage = null;
    } else {
      bgData.profileBgImage = rawBgImage;

      if (rawBgRepeat && !isValidBgRepeat(rawBgRepeat)) {
        return { success: false, message: "Invalid background repeat value." };
      }
      if (rawBgAttachment && !isValidBgAttachment(rawBgAttachment)) {
        return { success: false, message: "Invalid background attachment value." };
      }
      if (rawBgSize && !isValidBgSize(rawBgSize)) {
        return { success: false, message: "Invalid background size value." };
      }
      if (rawBgPosition && !isValidBgPosition(rawBgPosition)) {
        return { success: false, message: "Invalid background position value." };
      }

      bgData.profileBgRepeat = rawBgRepeat;
      bgData.profileBgAttachment = rawBgAttachment;
      bgData.profileBgSize = rawBgSize;
      bgData.profileBgPosition = rawBgPosition;
    }
  }

  // Parse sparklefall settings (premium only)
  const sparklefallEnabled = formData.get("sparklefallEnabled") === "true";
  const sparklefallData: Record<string, boolean | string | number | null> = {
    sparklefallEnabled: false,
    sparklefallPreset: null,
    sparklefallSparkles: null,
    sparklefallColors: null,
    sparklefallInterval: null,
    sparklefallWind: null,
    sparklefallMaxSparkles: null,
    sparklefallMinSize: null,
    sparklefallMaxSize: null,
  };

  if (isPremium && sparklefallEnabled) {
    sparklefallData.sparklefallEnabled = true;

    const rawPreset = (formData.get("sparklefallPreset") as string)?.trim() || null;
    if (rawPreset && isValidPreset(rawPreset)) {
      sparklefallData.sparklefallPreset = rawPreset;
    }

    const rawSparkles = (formData.get("sparklefallSparkles") as string)?.trim() || null;
    if (rawSparkles && parseJsonArray(rawSparkles)) {
      sparklefallData.sparklefallSparkles = rawSparkles;
    }

    const rawColors = (formData.get("sparklefallColors") as string)?.trim() || null;
    if (rawColors && parseJsonArray(rawColors)) {
      sparklefallData.sparklefallColors = rawColors;
    }

    const rawInterval = Number(formData.get("sparklefallInterval"));
    if (!isNaN(rawInterval)) {
      sparklefallData.sparklefallInterval = clamp(rawInterval, 100, 3000);
    }

    const rawWind = Number(formData.get("sparklefallWind"));
    if (!isNaN(rawWind)) {
      sparklefallData.sparklefallWind = clamp(rawWind, -1, 1);
    }

    const rawMaxSparkles = Number(formData.get("sparklefallMaxSparkles"));
    if (!isNaN(rawMaxSparkles)) {
      sparklefallData.sparklefallMaxSparkles = clamp(rawMaxSparkles, 5, 200);
    }

    const rawMinSize = Number(formData.get("sparklefallMinSize"));
    if (!isNaN(rawMinSize)) {
      sparklefallData.sparklefallMinSize = clamp(rawMinSize, 5, 100);
    }

    const rawMaxSize = Number(formData.get("sparklefallMaxSize"));
    if (!isNaN(rawMaxSize)) {
      sparklefallData.sparklefallMaxSize = clamp(rawMaxSize, 5, 100);
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      usernameFont,
      ...themeColors,
      ...bgData,
      ...sparklefallData,
    },
    select: { username: true },
  });

  // Invalidate cached public profile
  if (user.username) {
    await invalidate(cacheKeys.userProfile(user.username));
    revalidatePath(`/${user.username}`);
  }

  revalidatePath("/theme");
  return { success: true, message: "Theme updated" };
}
