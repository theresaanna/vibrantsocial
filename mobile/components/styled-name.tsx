import { Text, type TextStyle, StyleSheet } from "react-native";
import type { ReactNode } from "react";
import { FONT_ID_TO_FAMILY } from "@/hooks/use-app-fonts";

export interface FontDefinition {
  id: string;
  name: string;
  /** The Google Fonts family name used for loading */
  googleFamily: string;
  tier: "free" | "premium";
}

export const USERNAME_FONTS: FontDefinition[] = [
  { id: "sofadi-one", name: "Sofadi One", googleFamily: "Sofadi+One", tier: "free" },
  { id: "jersey-10", name: "Jersey 10", googleFamily: "Jersey+10", tier: "free" },
  { id: "limelight", name: "Limelight", googleFamily: "Limelight", tier: "free" },
  { id: "unkempt", name: "Unkempt", googleFamily: "Unkempt", tier: "free" },
  { id: "gugi", name: "Gugi", googleFamily: "Gugi", tier: "premium" },
  { id: "turret-road", name: "Turret Road", googleFamily: "Turret+Road", tier: "premium" },
  { id: "nova-mono", name: "Nova Mono", googleFamily: "Nova+Mono", tier: "premium" },
  { id: "ewert", name: "Ewert", googleFamily: "Ewert", tier: "premium" },
  { id: "ballet", name: "Ballet", googleFamily: "Ballet", tier: "premium" },
  { id: "rubik-puddles", name: "Rubik Puddles", googleFamily: "Rubik+Puddles", tier: "premium" },
  { id: "hachi-maru-pop", name: "Hachi Maru Pop", googleFamily: "Hachi+Maru+Pop", tier: "premium" },
  { id: "ms-madi", name: "Ms Madi", googleFamily: "Ms+Madi", tier: "premium" },
  { id: "jacquard-24", name: "Jacquard 24", googleFamily: "Jacquard+24", tier: "premium" },
  { id: "texturina", name: "Texturina", googleFamily: "Texturina", tier: "premium" },
  { id: "great-vibes", name: "Great Vibes", googleFamily: "Great+Vibes", tier: "premium" },
  { id: "rye", name: "Rye", googleFamily: "Rye", tier: "premium" },
  { id: "bonbon", name: "Bonbon", googleFamily: "Bonbon", tier: "premium" },
  { id: "agu-display", name: "Agu Display", googleFamily: "Agu+Display", tier: "premium" },
  { id: "agbalumo", name: "Agbalumo", googleFamily: "Agbalumo", tier: "premium" },
  { id: "manufacturing-consent", name: "Manufacturing Consent", googleFamily: "Manufacturing+Consent", tier: "premium" },
];

const FONT_MAP = new Map(USERNAME_FONTS.map((f) => [f.id, f]));

export function getFontById(id: string | null | undefined): FontDefinition | null {
  if (!id) return null;
  return FONT_MAP.get(id) ?? null;
}

interface StyledNameProps {
  fontId: string | null | undefined;
  children: ReactNode;
  style?: TextStyle;
}

/**
 * Renders a display name with the user's chosen custom Google Font.
 * Fonts are loaded at app startup via useAppFonts() in _layout.tsx.
 *
 * Important: On React Native, fontWeight must be stripped when using a
 * custom fontFamily because the weight is baked into the font file name
 * (e.g. "SofadiOne_400Regular"). Setting fontWeight alongside it causes
 * RN to look for a non-existent weight variant and fall back to system font.
 */
export function StyledName({ fontId, children, style }: StyledNameProps) {
  if (!fontId) {
    return <Text style={style}>{children}</Text>;
  }

  const fontFamily = FONT_ID_TO_FAMILY[fontId];
  if (!fontFamily) {
    return <Text style={style}>{children}</Text>;
  }

  // Strip fontWeight — it conflicts with custom font families on RN
  const { fontWeight, ...restStyle } = (style ?? {}) as TextStyle & { fontWeight?: string };

  return (
    <Text style={[restStyle, { fontFamily }]}>
      {children}
    </Text>
  );
}
