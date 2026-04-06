import { type ProfileThemeColors, THEME_COLOR_FIELDS, isValidHexColor } from "./profile-themes";
import { isValidBgRepeat, isValidBgAttachment, isValidBgSize, isValidBgPosition } from "./profile-backgrounds";

export interface ThemeExport {
  version: 1;
  colors: ProfileThemeColors;
  containerOpacity: number;
  background: {
    imageUrl: string | null;
    /** Base64-encoded image data for custom backgrounds (data:image/...;base64,...) */
    imageData?: string;
    repeat: string;
    attachment: string;
    size: string;
    position: string;
  };
}

export function validateThemeExport(data: unknown): ThemeExport | null {
  if (typeof data !== "object" || data === null) return null;
  const obj = data as Record<string, unknown>;

  if (obj.version !== 1) return null;

  // Validate colors
  if (typeof obj.colors !== "object" || obj.colors === null) return null;
  const colors = obj.colors as Record<string, unknown>;
  for (const field of THEME_COLOR_FIELDS) {
    if (typeof colors[field] !== "string" || !isValidHexColor(colors[field] as string)) {
      return null;
    }
  }

  // Validate containerOpacity
  if (typeof obj.containerOpacity !== "number" || obj.containerOpacity < 80 || obj.containerOpacity > 100) {
    return null;
  }

  // Validate background
  if (typeof obj.background !== "object" || obj.background === null) return null;
  const bg = obj.background as Record<string, unknown>;
  if (bg.imageUrl !== null && typeof bg.imageUrl !== "string") return null;
  if (bg.imageData !== undefined && typeof bg.imageData !== "string") return null;
  if (typeof bg.repeat !== "string" || !isValidBgRepeat(bg.repeat)) return null;
  if (typeof bg.attachment !== "string" || !isValidBgAttachment(bg.attachment)) return null;
  if (typeof bg.size !== "string" || !isValidBgSize(bg.size)) return null;
  if (typeof bg.position !== "string" || !isValidBgPosition(bg.position)) return null;

  // Validate imageData is a reasonable data URI if present
  if (typeof bg.imageData === "string" && !bg.imageData.startsWith("data:image/")) {
    return null;
  }

  return {
    version: 1,
    colors: colors as unknown as ProfileThemeColors,
    containerOpacity: obj.containerOpacity,
    background: {
      imageUrl: bg.imageUrl as string | null,
      ...(typeof bg.imageData === "string" ? { imageData: bg.imageData } : {}),
      repeat: bg.repeat as string,
      attachment: bg.attachment as string,
      size: bg.size as string,
      position: bg.position as string,
    },
  };
}
