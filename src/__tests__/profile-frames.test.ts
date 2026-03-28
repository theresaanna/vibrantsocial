import { describe, it, expect } from "vitest";
import {
  PROFILE_FRAMES,
  getFrameById,
  isValidFrameId,
} from "@/lib/profile-frames";

describe("profile-frames", () => {
  describe("PROFILE_FRAMES", () => {
    it("contains 27 frame definitions", () => {
      expect(PROFILE_FRAMES).toHaveLength(27);
    });

    it("has unique IDs", () => {
      const ids = PROFILE_FRAMES.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("all frames have valid src paths starting with /frames/", () => {
      for (const frame of PROFILE_FRAMES) {
        expect(frame.src).toMatch(/^\/frames\/[\w-]+\.(svg|png)$/);
      }
    });

    it("all frames have a non-empty name", () => {
      for (const frame of PROFILE_FRAMES) {
        expect(frame.name.length).toBeGreaterThan(0);
      }
    });

    it("includes all frame categories", () => {
      const categories = new Set(PROFILE_FRAMES.map((f) => f.category));
      expect(categories).toContain("spring");
      expect(categories).toContain("neon");
      expect(categories).toContain("decorative");
      expect(categories).toContain("floral");
      expect(categories).toContain("whimsy");
    });
  });

  describe("getFrameById", () => {
    it("returns the correct frame for a valid ID", () => {
      const frame = getFrameById("spring-1");
      expect(frame).not.toBeNull();
      expect(frame!.id).toBe("spring-1");
      expect(frame!.name).toBe("Spring Bloom");
    });

    it("returns null for an invalid ID", () => {
      expect(getFrameById("nonexistent")).toBeNull();
    });

    it("returns null for null input", () => {
      expect(getFrameById(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(getFrameById(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(getFrameById("")).toBeNull();
    });
  });

  describe("isValidFrameId", () => {
    it("returns true for valid frame IDs", () => {
      expect(isValidFrameId("spring-1")).toBe(true);
      expect(isValidFrameId("neon-3")).toBe(true);
    });

    it("returns false for invalid frame IDs", () => {
      expect(isValidFrameId("nonexistent")).toBe(false);
      expect(isValidFrameId("")).toBe(false);
    });
  });
});
