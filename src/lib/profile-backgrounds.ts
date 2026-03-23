export type BgCategory = "pattern" | "photo";

export interface BgDefaults {
  repeat?: BgRepeat;
  size?: BgSize;
  position?: BgPosition;
  attachment?: BgAttachment;
}

export interface BackgroundDefinition {
  id: string;
  name: string;
  src: string;
  thumbSrc: string;
  category: BgCategory;
  defaults?: BgDefaults;
}

export const VALID_BG_REPEAT = ["repeat", "repeat-x", "repeat-y", "no-repeat"] as const;
export const VALID_BG_ATTACHMENT = ["scroll", "fixed"] as const;
export const VALID_BG_SIZE = ["cover", "contain", "auto"] as const;
export const VALID_BG_POSITION = [
  "center", "top", "bottom", "left", "right",
  "top left", "top center", "top right",
  "center left", "center center", "center right",
  "bottom left", "bottom center", "bottom right",
] as const;

export type BgRepeat = (typeof VALID_BG_REPEAT)[number];
export type BgAttachment = (typeof VALID_BG_ATTACHMENT)[number];
export type BgSize = (typeof VALID_BG_SIZE)[number];
export type BgPosition = (typeof VALID_BG_POSITION)[number];

const CATEGORY_DEFAULTS: Record<BgCategory, Required<BgDefaults>> = {
  pattern: { repeat: "repeat", size: "auto", position: "top left", attachment: "scroll" },
  photo: { repeat: "no-repeat", size: "cover", position: "center", attachment: "scroll" },
};

export function getDefaultsForBackground(bg: BackgroundDefinition): Required<BgDefaults> {
  const base = CATEGORY_DEFAULTS[bg.category];
  if (!bg.defaults) return base;
  return { ...base, ...bg.defaults };
}

export function isValidBgRepeat(v: string): v is BgRepeat {
  return (VALID_BG_REPEAT as readonly string[]).includes(v);
}
export function isValidBgAttachment(v: string): v is BgAttachment {
  return (VALID_BG_ATTACHMENT as readonly string[]).includes(v);
}
export function isValidBgSize(v: string): v is BgSize {
  return (VALID_BG_SIZE as readonly string[]).includes(v);
}
export function isValidBgPosition(v: string): v is BgPosition {
  return (VALID_BG_POSITION as readonly string[]).includes(v);
}
