import { describe, it, expect } from "vitest";
import { normalizeTag, extractTagsFromNames, isValidTag } from "@/lib/tags";

describe("normalizeTag", () => {
  it("converts to lowercase", () => {
    expect(normalizeTag("JavaScript")).toBe("javascript");
  });

  it("trims whitespace", () => {
    expect(normalizeTag("  react  ")).toBe("react");
  });

  it("strips leading #", () => {
    expect(normalizeTag("#typescript")).toBe("typescript");
  });

  it("removes special characters except hyphens", () => {
    expect(normalizeTag("c++")).toBe("c");
    expect(normalizeTag("node.js")).toBe("nodejs");
    expect(normalizeTag("web-dev")).toBe("web-dev");
  });

  it("truncates to 50 characters", () => {
    const longTag = "a".repeat(60);
    expect(normalizeTag(longTag)).toHaveLength(50);
  });

  it("handles empty string", () => {
    expect(normalizeTag("")).toBe("");
  });

  it("handles string with only special characters", () => {
    expect(normalizeTag("!!!")).toBe("");
  });

  it("handles multiple leading hashes", () => {
    expect(normalizeTag("##tag")).toBe("tag");
  });
});

describe("extractTagsFromNames", () => {
  it("normalizes and deduplicates", () => {
    const result = extractTagsFromNames(["React", "react", "#REACT"]);
    expect(result).toEqual(["react"]);
  });

  it("filters out invalid tags", () => {
    const result = extractTagsFromNames(["valid", "", "!!!", "also-valid"]);
    expect(result).toEqual(["valid", "also-valid"]);
  });

  it("returns empty array for empty input", () => {
    expect(extractTagsFromNames([])).toEqual([]);
  });

  it("preserves order of first occurrence", () => {
    const result = extractTagsFromNames(["beta", "alpha", "Beta"]);
    expect(result).toEqual(["beta", "alpha"]);
  });
});

describe("isValidTag", () => {
  it("returns true for valid tags", () => {
    expect(isValidTag("react")).toBe(true);
    expect(isValidTag("#typescript")).toBe(true);
    expect(isValidTag("web-dev")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidTag("")).toBe(false);
  });

  it("returns false for only special characters", () => {
    expect(isValidTag("!!!")).toBe(false);
  });

  it("returns false for whitespace only", () => {
    expect(isValidTag("   ")).toBe(false);
  });
});
