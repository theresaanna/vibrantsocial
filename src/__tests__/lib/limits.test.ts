import { describe, it, expect } from "vitest";
import {
  getLimitsForTier,
  DEFAULT_LIMITS,
  formatSizeLimit,
  getChatFileLimitsHint,
} from "@/lib/limits";

describe("limits config", () => {
  it("returns free tier limits by default", () => {
    const limits = getLimitsForTier();
    expect(limits.maxImageSize).toBe(5 * 1024 * 1024);
    expect(limits.maxVideoSize).toBe(50 * 1024 * 1024);
    expect(limits.maxAudioSize).toBe(10 * 1024 * 1024);
    expect(limits.maxDocumentSize).toBe(10 * 1024 * 1024);
    expect(limits.maxVoiceNoteDuration).toBe(20);
  });

  it("returns free tier limits when explicitly requested", () => {
    const limits = getLimitsForTier("free");
    expect(limits.maxVoiceNoteDuration).toBe(20);
    expect(limits.maxImageSize).toBe(5 * 1024 * 1024);
  });

  it("returns premium tier limits", () => {
    const limits = getLimitsForTier("premium");
    expect(limits.maxImageSize).toBe(20 * 1024 * 1024);
    expect(limits.maxVideoSize).toBe(200 * 1024 * 1024);
    expect(limits.maxAudioSize).toBe(50 * 1024 * 1024);
    expect(limits.maxDocumentSize).toBe(50 * 1024 * 1024);
    expect(limits.maxVoiceNoteDuration).toBe(120);
  });

  it("DEFAULT_LIMITS matches free tier", () => {
    expect(DEFAULT_LIMITS).toEqual(getLimitsForTier("free"));
  });

  it("premium limits are larger than free limits", () => {
    const free = getLimitsForTier("free");
    const premium = getLimitsForTier("premium");
    expect(premium.maxImageSize).toBeGreaterThan(free.maxImageSize);
    expect(premium.maxVideoSize).toBeGreaterThan(free.maxVideoSize);
    expect(premium.maxAudioSize).toBeGreaterThan(free.maxAudioSize);
    expect(premium.maxDocumentSize).toBeGreaterThan(free.maxDocumentSize);
    expect(premium.maxVoiceNoteDuration).toBeGreaterThan(free.maxVoiceNoteDuration);
  });
});

describe("formatSizeLimit", () => {
  it("formats megabytes correctly", () => {
    expect(formatSizeLimit(5 * 1024 * 1024)).toBe("5MB");
    expect(formatSizeLimit(50 * 1024 * 1024)).toBe("50MB");
    expect(formatSizeLimit(200 * 1024 * 1024)).toBe("200MB");
  });

  it("formats kilobytes correctly", () => {
    expect(formatSizeLimit(512 * 1024)).toBe("512KB");
  });
});

describe("getChatFileLimitsHint", () => {
  it("includes all file categories for free tier", () => {
    const hint = getChatFileLimitsHint();
    expect(hint).toContain("Images");
    expect(hint).toContain("Videos");
    expect(hint).toContain("Audio");
    expect(hint).toContain("PDF");
  });

  it("shows free tier sizes by default", () => {
    const hint = getChatFileLimitsHint();
    expect(hint).toContain("5MB");
    expect(hint).toContain("50MB");
    expect(hint).toContain("10MB");
  });

  it("shows premium tier sizes when provided", () => {
    const premiumLimits = getLimitsForTier("premium");
    const hint = getChatFileLimitsHint(premiumLimits);
    expect(hint).toContain("20MB");
    expect(hint).toContain("200MB");
    expect(hint).toContain("50MB");
  });
});
