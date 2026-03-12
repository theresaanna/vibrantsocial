export type UserTier = "free" | "premium";

export interface TierLimits {
  /** Max file sizes in bytes */
  maxImageSize: number;
  maxVideoSize: number;
  maxAudioSize: number;
  maxDocumentSize: number;
  /** Voice note max duration in seconds */
  maxVoiceNoteDuration: number;
}

const FREE_LIMITS: TierLimits = {
  maxImageSize: 5 * 1024 * 1024, // 5MB
  maxVideoSize: 50 * 1024 * 1024, // 50MB
  maxAudioSize: 10 * 1024 * 1024, // 10MB
  maxDocumentSize: 10 * 1024 * 1024, // 10MB
  maxVoiceNoteDuration: 20, // 20 seconds
};

const PREMIUM_LIMITS: TierLimits = {
  maxImageSize: 20 * 1024 * 1024, // 20MB
  maxVideoSize: 200 * 1024 * 1024, // 200MB
  maxAudioSize: 50 * 1024 * 1024, // 50MB
  maxDocumentSize: 50 * 1024 * 1024, // 50MB
  maxVoiceNoteDuration: 120, // 2 minutes
};

const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: FREE_LIMITS,
  premium: PREMIUM_LIMITS,
};

export function getLimitsForTier(tier: UserTier = "free"): TierLimits {
  return TIER_LIMITS[tier];
}

/** Default limits (free tier) for client components without tier context */
export const DEFAULT_LIMITS = FREE_LIMITS;

export function formatSizeLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${bytes / (1024 * 1024)}MB`;
  return `${bytes / 1024}KB`;
}

export function getChatFileLimitsHint(
  limits: TierLimits = DEFAULT_LIMITS
): string {
  return `Images ${formatSizeLimit(limits.maxImageSize)} · Videos ${formatSizeLimit(limits.maxVideoSize)} · Audio ${formatSizeLimit(limits.maxAudioSize)} · PDF ${formatSizeLimit(limits.maxDocumentSize)}`;
}
