"use server";

import { auth } from "@/auth";
import { anthropic } from "@/lib/anthropic";
import { prisma } from "@/lib/prisma";
import { checkAndExpirePremium } from "@/lib/premium";
import { apiLimiter, isRateLimited } from "@/lib/rate-limit";
import {
  type ProfileThemeColors,
  type CustomPresetData,
  isValidHexColor,
  adjustForContrast,
  THEME_COLOR_FIELDS,
} from "@/lib/profile-themes";
import { headers } from "next/headers";

const MAX_PROMPT_LENGTH = 200;
const MAX_PRESETS_PER_USER = 10;

interface GenerateThemeResult {
  success: boolean;
  name?: string;
  light?: ProfileThemeColors;
  dark?: ProfileThemeColors;
  error?: string;
}

interface SavePresetResult {
  success: boolean;
  preset?: CustomPresetData;
  error?: string;
}

interface DeletePresetResult {
  success: boolean;
  error?: string;
}

async function resolveImageUrl(imageUrl: string): Promise<string> {
  if (/^https?:\/\//.test(imageUrl)) return imageUrl;
  // Relative path — resolve using the request host
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "vibrantsocial.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

function enforceContrast(colors: ProfileThemeColors): ProfileThemeColors {
  return {
    profileBgColor: colors.profileBgColor,
    profileTextColor: adjustForContrast(
      colors.profileTextColor,
      colors.profileBgColor,
      4.5
    ),
    profileLinkColor: adjustForContrast(
      colors.profileLinkColor,
      colors.profileBgColor,
      4.5
    ),
    profileSecondaryColor: adjustForContrast(
      colors.profileSecondaryColor,
      colors.profileBgColor,
      4.5
    ),
    profileContainerColor: colors.profileContainerColor,
  };
}

function validateThemeColors(
  obj: Record<string, unknown>
): obj is Record<(typeof THEME_COLOR_FIELDS)[number], string> {
  return THEME_COLOR_FIELDS.every(
    (field) =>
      typeof obj[field] === "string" && isValidHexColor(obj[field] as string)
  );
}

function toProfileColors(
  obj: Record<string, string>
): ProfileThemeColors {
  return {
    profileBgColor: obj.profileBgColor,
    profileTextColor: obj.profileTextColor,
    profileLinkColor: obj.profileLinkColor,
    profileSecondaryColor: obj.profileSecondaryColor,
    profileContainerColor: obj.profileContainerColor,
  };
}

export async function generateTheme(
  imageUrl: string
): Promise<GenerateThemeResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  if (await isRateLimited(apiLimiter, `generate-theme:${session.user.id}`)) {
    return {
      success: false,
      error: "Too many requests. Please try again later.",
    };
  }

  const isPremium = await checkAndExpirePremium(session.user.id);
  if (!isPremium) {
    return { success: false, error: "Premium subscription required" };
  }

  if (!imageUrl.trim()) {
    return { success: false, error: "Please select a background image" };
  }

  try {
    const absoluteUrl = await resolveImageUrl(imageUrl);
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system:
        "You are a color scheme designer for social media profiles. Given a background image, analyze its dominant colors, mood, and aesthetic to generate a cohesive color scheme with both light and dark variants that complement the background. Each variant needs 5 hex colors: profileBgColor (main page background), profileTextColor (primary text), profileLinkColor (links and accent), profileSecondaryColor (muted/secondary text), and profileContainerColor (card/container background, slightly offset from main bg). The colors should feel like they belong with the background image. Ensure good readability with sufficient contrast between text and background. Also generate a short creative name for the theme (2-3 words max). Return ONLY valid JSON, no other text.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: absoluteUrl },
            },
            {
              type: "text",
              text: `Analyze this background image and generate a color scheme that complements it.

Return JSON in this exact format:
{
  "name": "Theme Name",
  "light": {
    "profileBgColor": "#hex",
    "profileTextColor": "#hex",
    "profileLinkColor": "#hex",
    "profileSecondaryColor": "#hex",
    "profileContainerColor": "#hex"
  },
  "dark": {
    "profileBgColor": "#hex",
    "profileTextColor": "#hex",
    "profileLinkColor": "#hex",
    "profileSecondaryColor": "#hex",
    "profileContainerColor": "#hex"
  }
}`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "Failed to generate theme. Try again." };
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("light" in parsed) ||
      !("dark" in parsed) ||
      !("name" in parsed)
    ) {
      return { success: false, error: "Failed to generate theme. Try again." };
    }

    const data = parsed as {
      name: unknown;
      light: Record<string, unknown>;
      dark: Record<string, unknown>;
    };

    if (!validateThemeColors(data.light) || !validateThemeColors(data.dark)) {
      return {
        success: false,
        error: "Generated invalid colors. Try again.",
      };
    }

    const light = enforceContrast(toProfileColors(data.light as Record<string, string>));
    const dark = enforceContrast(toProfileColors(data.dark as Record<string, string>));

    const name =
      typeof data.name === "string" && data.name.trim()
        ? data.name.trim().slice(0, 30)
        : "Custom Theme";

    return { success: true, name, light, dark };
  } catch {
    return { success: false, error: "Failed to generate theme. Try again." };
  }
}

export async function saveCustomPreset(data: {
  name: string;
  imageUrl: string;
  light: ProfileThemeColors;
  dark: ProfileThemeColors;
}): Promise<SavePresetResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const isPremium = await checkAndExpirePremium(session.user.id);
  if (!isPremium) {
    return { success: false, error: "Premium subscription required" };
  }

  const name = data.name.trim().slice(0, 30);
  if (!name) {
    return { success: false, error: "Preset name is required" };
  }

  // Validate all colors
  for (const colors of [data.light, data.dark]) {
    for (const field of THEME_COLOR_FIELDS) {
      if (!isValidHexColor(colors[field])) {
        return { success: false, error: "Invalid color values" };
      }
    }
  }

  // Check preset count limit
  const count = await prisma.customThemePreset.count({
    where: { userId: session.user.id },
  });

  // Allow upsert on same name, but block new ones past limit
  const existing = await prisma.customThemePreset.findUnique({
    where: { userId_name: { userId: session.user.id, name } },
  });

  if (!existing && count >= MAX_PRESETS_PER_USER) {
    return {
      success: false,
      error: `Maximum of ${MAX_PRESETS_PER_USER} custom presets reached. Delete one first.`,
    };
  }

  const record = await prisma.customThemePreset.upsert({
    where: { userId_name: { userId: session.user.id, name } },
    update: {
      prompt: data.imageUrl.slice(0, MAX_PROMPT_LENGTH),
      lightBgColor: data.light.profileBgColor,
      lightTextColor: data.light.profileTextColor,
      lightLinkColor: data.light.profileLinkColor,
      lightSecondaryColor: data.light.profileSecondaryColor,
      lightContainerColor: data.light.profileContainerColor,
      darkBgColor: data.dark.profileBgColor,
      darkTextColor: data.dark.profileTextColor,
      darkLinkColor: data.dark.profileLinkColor,
      darkSecondaryColor: data.dark.profileSecondaryColor,
      darkContainerColor: data.dark.profileContainerColor,
    },
    create: {
      userId: session.user.id,
      name,
      prompt: data.imageUrl.slice(0, MAX_PROMPT_LENGTH),
      lightBgColor: data.light.profileBgColor,
      lightTextColor: data.light.profileTextColor,
      lightLinkColor: data.light.profileLinkColor,
      lightSecondaryColor: data.light.profileSecondaryColor,
      lightContainerColor: data.light.profileContainerColor,
      darkBgColor: data.dark.profileBgColor,
      darkTextColor: data.dark.profileTextColor,
      darkLinkColor: data.dark.profileLinkColor,
      darkSecondaryColor: data.dark.profileSecondaryColor,
      darkContainerColor: data.dark.profileContainerColor,
    },
  });

  return {
    success: true,
    preset: {
      id: record.id,
      name: record.name,
      prompt: record.prompt,
      light: {
        profileBgColor: record.lightBgColor,
        profileTextColor: record.lightTextColor,
        profileLinkColor: record.lightLinkColor,
        profileSecondaryColor: record.lightSecondaryColor,
        profileContainerColor: record.lightContainerColor,
      },
      dark: {
        profileBgColor: record.darkBgColor,
        profileTextColor: record.darkTextColor,
        profileLinkColor: record.darkLinkColor,
        profileSecondaryColor: record.darkSecondaryColor,
        profileContainerColor: record.darkContainerColor,
      },
    },
  };
}

export async function deleteCustomPreset(
  presetId: string
): Promise<DeletePresetResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const preset = await prisma.customThemePreset.findUnique({
    where: { id: presetId },
  });

  if (!preset || preset.userId !== session.user.id) {
    return { success: false, error: "Preset not found" };
  }

  await prisma.customThemePreset.delete({ where: { id: presetId } });
  return { success: true };
}
