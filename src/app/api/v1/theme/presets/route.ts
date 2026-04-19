/**
 * User-saved custom theme presets.
 *
 * GET  /api/v1/theme/presets            → list the viewer's presets
 * POST /api/v1/theme/presets            → create (or upsert by name)
 *
 * Mirrors the web `saveCustomPreset` server action. Enforces the same
 * per-user cap of 10 presets, supports upsert on (userId, name) so
 * saving the same name overwrites rather than failing.
 */
import { prisma } from "@/lib/prisma";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";
import { requireViewer } from "@/lib/require-viewer";
import { isValidHexColor } from "@/lib/profile-themes";
import { checkAndExpirePremium } from "@/lib/premium";

const MAX_PRESETS = 10;

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function GET(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;

  const presets = await prisma.customThemePreset.findMany({
    where: { userId: viewer.userId },
    orderBy: { createdAt: "desc" },
  });

  return corsJson(req, {
    presets: presets.map((p: (typeof presets)[number]) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.prompt,
      colors: {
        profileBgColor: p.lightBgColor,
        profileTextColor: p.lightTextColor,
        profileLinkColor: p.lightLinkColor,
        profileSecondaryColor: p.lightSecondaryColor,
        profileContainerColor: p.lightContainerColor,
      },
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

interface PresetPayload {
  name?: string;
  imageUrl?: string;
  colors?: Record<string, string>;
}

export async function POST(req: Request) {
  const viewer = await requireViewer(req);
  if (!viewer.ok) return viewer.response;
  const userId = viewer.userId;

  // Saving custom presets is premium-only — matches the web's
  // `saveCustomPreset` server action.
  if (!(await checkAndExpirePremium(userId))) {
    return corsJson(
      req,
      { error: "Premium subscription required" },
      { status: 403 },
    );
  }

  let body: PresetPayload;
  try {
    body = (await req.json()) as PresetPayload;
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  const imageUrl = body.imageUrl?.trim();
  if (!name || !imageUrl || !body.colors) {
    return corsJson(req, { error: "Missing fields" }, { status: 400 });
  }
  if (name.length > 50) {
    return corsJson(req, { error: "Name too long" }, { status: 400 });
  }

  const c = body.colors;
  const required = [
    "profileBgColor",
    "profileTextColor",
    "profileLinkColor",
    "profileSecondaryColor",
    "profileContainerColor",
  ];
  for (const k of required) {
    if (typeof c[k] !== "string" || !isValidHexColor(c[k])) {
      return corsJson(req, { error: `Invalid color ${k}` }, { status: 400 });
    }
  }

  const existing = await prisma.customThemePreset.findUnique({
    where: { userId_name: { userId, name } },
  });
  if (!existing) {
    const count = await prisma.customThemePreset.count({ where: { userId } });
    if (count >= MAX_PRESETS) {
      return corsJson(
        req,
        { error: `You can save at most ${MAX_PRESETS} presets.` },
        { status: 400 },
      );
    }
  }

  // imageUrl is stored in `prompt` (legacy column name) capped at 200
  // chars to protect the DB from pathologically long urls.
  const preset = await prisma.customThemePreset.upsert({
    where: { userId_name: { userId, name } },
    create: {
      userId,
      name,
      prompt: imageUrl.slice(0, 200),
      lightBgColor: c.profileBgColor,
      lightTextColor: c.profileTextColor,
      lightLinkColor: c.profileLinkColor,
      lightSecondaryColor: c.profileSecondaryColor,
      lightContainerColor: c.profileContainerColor,
      darkBgColor: c.profileBgColor,
      darkTextColor: c.profileTextColor,
      darkLinkColor: c.profileLinkColor,
      darkSecondaryColor: c.profileSecondaryColor,
      darkContainerColor: c.profileContainerColor,
    },
    update: {
      prompt: imageUrl.slice(0, 200),
      lightBgColor: c.profileBgColor,
      lightTextColor: c.profileTextColor,
      lightLinkColor: c.profileLinkColor,
      lightSecondaryColor: c.profileSecondaryColor,
      lightContainerColor: c.profileContainerColor,
      darkBgColor: c.profileBgColor,
      darkTextColor: c.profileTextColor,
      darkLinkColor: c.profileLinkColor,
      darkSecondaryColor: c.profileSecondaryColor,
      darkContainerColor: c.profileContainerColor,
    },
  });

  return corsJson(req, {
    preset: {
      id: preset.id,
      name: preset.name,
      imageUrl: preset.prompt,
      colors: {
        profileBgColor: preset.lightBgColor,
        profileTextColor: preset.lightTextColor,
        profileLinkColor: preset.lightLinkColor,
        profileSecondaryColor: preset.lightSecondaryColor,
        profileContainerColor: preset.lightContainerColor,
      },
      createdAt: preset.createdAt.toISOString(),
    },
  });
}
