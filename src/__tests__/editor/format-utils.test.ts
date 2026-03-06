import { describe, it, expect } from "vitest";
import { formatFileSize } from "@/components/editor/nodes/FileComponent";

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats zero bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats exact kilobyte", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(5242880)).toBe("5.0 MB");
  });

  it("formats fractional megabytes", () => {
    expect(formatFileSize(1572864)).toBe("1.5 MB");
  });
});
