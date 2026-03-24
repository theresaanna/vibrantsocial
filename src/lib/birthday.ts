import { SPARKLEFALL_PRESETS } from "./sparklefall-presets";

/**
 * Check if today is the user's birthday based on month/day.
 */
export function isBirthday(
  birthdayMonth: number | null,
  birthdayDay: number | null,
  now: Date = new Date()
): boolean {
  if (birthdayMonth == null || birthdayDay == null) return false;
  return now.getMonth() + 1 === birthdayMonth && now.getDate() === birthdayDay;
}

/**
 * Get the party sparklefall config for birthday celebrations.
 */
export function getBirthdaySparkleConfig() {
  const partyPreset = SPARKLEFALL_PRESETS.party;
  return {
    sparkles: JSON.stringify(partyPreset.sparkles),
    colors: null,
    interval: 600,
    wind: null,
    maxSparkles: 80,
    minSize: null,
    maxSize: null,
  };
}
