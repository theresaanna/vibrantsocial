export interface FontDefinition {
  id: string;
  name: string;
  googleFamily: string;
  tier: "free" | "premium";
}

export const USERNAME_FONTS: FontDefinition[] = [
  // Free tier fonts
  { id: "sofadi-one", name: "Sofadi One", googleFamily: "Sofadi+One", tier: "free" },
  { id: "jersey-10", name: "Jersey 10", googleFamily: "Jersey+10", tier: "free" },
  // Premium tier fonts
  { id: "gugi", name: "Gugi", googleFamily: "Gugi", tier: "premium" },
  { id: "turret-road", name: "Turret Road", googleFamily: "Turret+Road", tier: "premium" },
  { id: "nova-mono", name: "Nova Mono", googleFamily: "Nova+Mono", tier: "premium" },
  { id: "ewert", name: "Ewert", googleFamily: "Ewert", tier: "premium" },
  { id: "ballet", name: "Ballet", googleFamily: "Ballet", tier: "premium" },
  { id: "manufacturing-consent", name: "Manufacturing Consent", googleFamily: "Manufacturing+Consent", tier: "premium" },
  { id: "rubik-puddles", name: "Rubik Puddles", googleFamily: "Rubik+Puddles", tier: "premium" },
  { id: "hachi-maru-pop", name: "Hachi Maru Pop", googleFamily: "Hachi+Maru+Pop", tier: "premium" },
  { id: "ms-madi", name: "Ms Madi", googleFamily: "Ms+Madi", tier: "premium" },
  { id: "jacquard-24", name: "Jacquard 24", googleFamily: "Jacquard+24", tier: "premium" },
];

const FONT_MAP = new Map(USERNAME_FONTS.map((f) => [f.id, f]));

export function getFontById(id: string | null | undefined): FontDefinition | null {
  if (!id) return null;
  return FONT_MAP.get(id) ?? null;
}

export function isValidFontId(id: string): boolean {
  return FONT_MAP.has(id);
}

export function getFontsForTier(tier: "free" | "premium"): FontDefinition[] {
  if (tier === "premium") return USERNAME_FONTS;
  return USERNAME_FONTS.filter((f) => f.tier === "free");
}

/** Returns a Google Fonts CSS URL to lazy-load a single font. */
export function getGoogleFontUrl(font: FontDefinition): string {
  return `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`;
}

/** Returns a Google Fonts CSS URL to load multiple fonts at once. */
export function getGoogleFontsUrl(fonts: FontDefinition[]): string {
  const families = fonts.map((f) => `family=${f.googleFamily}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
