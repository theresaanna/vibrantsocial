export interface BackgroundDefinition {
  id: string;
  name: string;
  src: string;
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
