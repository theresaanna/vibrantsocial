/**
 * Loads all app fonts: Lexend (base UI font) + all username display fonts.
 * Call once at app root. Returns { fontsLoaded, fontError }.
 */
import { useFonts } from "expo-font";

// Lexend — the app's primary UI font (matching web)
import {
  Lexend_300Light,
  Lexend_400Regular,
} from "@expo-google-fonts/lexend";

// Username display fonts
import { SofadiOne_400Regular } from "@expo-google-fonts/sofadi-one";
import { Jersey10_400Regular } from "@expo-google-fonts/jersey-10";
import { Limelight_400Regular } from "@expo-google-fonts/limelight";
import { Unkempt_400Regular } from "@expo-google-fonts/unkempt";
import { Gugi_400Regular } from "@expo-google-fonts/gugi";
import { TurretRoad_400Regular } from "@expo-google-fonts/turret-road";
import { NovaMono_400Regular } from "@expo-google-fonts/nova-mono";
import { Ewert_400Regular } from "@expo-google-fonts/ewert";
import { Ballet_400Regular } from "@expo-google-fonts/ballet";
import { RubikPuddles_400Regular } from "@expo-google-fonts/rubik-puddles";
import { HachiMaruPop_400Regular } from "@expo-google-fonts/hachi-maru-pop";
import { MsMadi_400Regular } from "@expo-google-fonts/ms-madi";
import { Jacquard24_400Regular } from "@expo-google-fonts/jacquard-24";
import { Texturina_400Regular } from "@expo-google-fonts/texturina";
import { GreatVibes_400Regular } from "@expo-google-fonts/great-vibes";
import { Rye_400Regular } from "@expo-google-fonts/rye";
import { Bonbon_400Regular } from "@expo-google-fonts/bonbon";
import { AguDisplay_400Regular } from "@expo-google-fonts/agu-display";
import { Agbalumo_400Regular } from "@expo-google-fonts/agbalumo";
import { ManufacturingConsent_400Regular } from "@expo-google-fonts/manufacturing-consent";

export function useAppFonts() {
  return useFonts({
    // Primary UI font
    Lexend_300Light,
    Lexend_400Regular,

    // Username display fonts — keys match what we use in fontFamily
    SofadiOne_400Regular,
    Jersey10_400Regular,
    Limelight_400Regular,
    Unkempt_400Regular,
    Gugi_400Regular,
    TurretRoad_400Regular,
    NovaMono_400Regular,
    Ewert_400Regular,
    Ballet_400Regular,
    RubikPuddles_400Regular,
    HachiMaruPop_400Regular,
    MsMadi_400Regular,
    Jacquard24_400Regular,
    Texturina_400Regular,
    GreatVibes_400Regular,
    Rye_400Regular,
    Bonbon_400Regular,
    AguDisplay_400Regular,
    Agbalumo_400Regular,
    ManufacturingConsent_400Regular,
  });
}

/**
 * Maps font IDs (from the database) to the loaded font family names.
 * These must match the keys passed to useFonts above.
 */
export const FONT_ID_TO_FAMILY: Record<string, string> = {
  "sofadi-one": "SofadiOne_400Regular",
  "jersey-10": "Jersey10_400Regular",
  "limelight": "Limelight_400Regular",
  "unkempt": "Unkempt_400Regular",
  "gugi": "Gugi_400Regular",
  "turret-road": "TurretRoad_400Regular",
  "nova-mono": "NovaMono_400Regular",
  "ewert": "Ewert_400Regular",
  "ballet": "Ballet_400Regular",
  "rubik-puddles": "RubikPuddles_400Regular",
  "hachi-maru-pop": "HachiMaruPop_400Regular",
  "ms-madi": "MsMadi_400Regular",
  "jacquard-24": "Jacquard24_400Regular",
  "texturina": "Texturina_400Regular",
  "great-vibes": "GreatVibes_400Regular",
  "rye": "Rye_400Regular",
  "bonbon": "Bonbon_400Regular",
  "agu-display": "AguDisplay_400Regular",
  "agbalumo": "Agbalumo_400Regular",
  "manufacturing-consent": "ManufacturingConsent_400Regular",
};
