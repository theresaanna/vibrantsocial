import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const layoutSource = readFileSync(
  resolve(__dirname, "../app/layout.tsx"),
  "utf-8"
);

describe("RootLayout configuration", () => {
  describe("font weights", () => {
    it("does not load font weight 100 (unused thin weight)", () => {
      // Weight 100 adds ~15KB to font download with no usage
      expect(layoutSource).not.toMatch(/weight.*"100"/);
    });

    it("does not load font weight 200 (unused extra-light weight)", () => {
      // Weight 200 adds ~15KB to font download with no usage
      expect(layoutSource).not.toMatch(/weight.*"200"/);
    });

    it("loads font weight 300 and 400", () => {
      expect(layoutSource).toMatch(/weight.*"300"/);
      expect(layoutSource).toMatch(/weight.*"400"/);
    });
  });

  describe("DNS prefetch hints", () => {
    it("includes dns-prefetch for Ably realtime", () => {
      expect(layoutSource).toContain("dns-prefetch");
      expect(layoutSource).toContain("realtime.ably.io");
    });

    it("includes preconnect for Google Fonts", () => {
      expect(layoutSource).toContain("preconnect");
      expect(layoutSource).toContain("fonts.googleapis.com");
      expect(layoutSource).toContain("fonts.gstatic.com");
    });
  });

  describe("streaming", () => {
    it("Header is not async in the layout (uses Suspense instead)", () => {
      // The Header component should be rendered directly (not awaited)
      // so Next.js can stream the page shell immediately.
      expect(layoutSource).not.toMatch(/await\s+Header/);
    });
  });
});
