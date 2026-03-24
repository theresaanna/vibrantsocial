import { describe, it, expect } from "vitest";
import { isBirthday, getBirthdaySparkleConfig } from "@/lib/birthday";

describe("isBirthday", () => {
  it("returns true when today matches birthday month and day", () => {
    const march15 = new Date(2026, 2, 15); // March 15
    expect(isBirthday(3, 15, march15)).toBe(true);
  });

  it("returns false when month matches but day does not", () => {
    const march15 = new Date(2026, 2, 15);
    expect(isBirthday(3, 20, march15)).toBe(false);
  });

  it("returns false when day matches but month does not", () => {
    const march15 = new Date(2026, 2, 15);
    expect(isBirthday(6, 15, march15)).toBe(false);
  });

  it("returns false when both are null", () => {
    expect(isBirthday(null, null)).toBe(false);
  });

  it("returns false when month is null", () => {
    expect(isBirthday(null, 15)).toBe(false);
  });

  it("returns false when day is null", () => {
    expect(isBirthday(3, null)).toBe(false);
  });

  it("works for January 1", () => {
    const jan1 = new Date(2026, 0, 1);
    expect(isBirthday(1, 1, jan1)).toBe(true);
  });

  it("works for December 31", () => {
    const dec31 = new Date(2026, 11, 31);
    expect(isBirthday(12, 31, dec31)).toBe(true);
  });

  it("returns false for wrong year-independent date", () => {
    const feb28 = new Date(2026, 1, 28);
    expect(isBirthday(2, 29, feb28)).toBe(false);
  });
});

describe("getBirthdaySparkleConfig", () => {
  it("returns party preset sparkles", () => {
    const config = getBirthdaySparkleConfig();
    const sparkles = JSON.parse(config.sparkles);
    expect(sparkles).toContain("🎉");
    expect(sparkles).toContain("🎊");
    expect(sparkles).toContain("🥳");
    expect(sparkles).toContain("🎈");
  });

  it("returns faster interval than default", () => {
    const config = getBirthdaySparkleConfig();
    expect(config.interval).toBe(600);
  });

  it("returns higher max sparkles for celebration effect", () => {
    const config = getBirthdaySparkleConfig();
    expect(config.maxSparkles).toBe(80);
  });

  it("returns null for colors (uses default)", () => {
    const config = getBirthdaySparkleConfig();
    expect(config.colors).toBeNull();
  });
});
