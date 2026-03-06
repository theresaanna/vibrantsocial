import { describe, it, expect } from "vitest";
import { timeAgo } from "@/lib/time";

describe("timeAgo", () => {
  it("returns 'just now' for times less than 60 seconds ago", () => {
    expect(timeAgo(new Date())).toBe("just now");
    expect(timeAgo(new Date(Date.now() - 30_000))).toBe("just now");
    expect(timeAgo(new Date(Date.now() - 59_000))).toBe("just now");
  });

  it("returns minutes for 1-59 minutes ago", () => {
    expect(timeAgo(new Date(Date.now() - 60_000))).toBe("1m");
    expect(timeAgo(new Date(Date.now() - 5 * 60_000))).toBe("5m");
    expect(timeAgo(new Date(Date.now() - 59 * 60_000))).toBe("59m");
  });

  it("returns hours for 1-23 hours ago", () => {
    expect(timeAgo(new Date(Date.now() - 60 * 60_000))).toBe("1h");
    expect(timeAgo(new Date(Date.now() - 12 * 60 * 60_000))).toBe("12h");
    expect(timeAgo(new Date(Date.now() - 23 * 60 * 60_000))).toBe("23h");
  });

  it("returns days for 1-29 days ago", () => {
    expect(timeAgo(new Date(Date.now() - 24 * 60 * 60_000))).toBe("1d");
    expect(timeAgo(new Date(Date.now() - 7 * 24 * 60 * 60_000))).toBe("7d");
    expect(timeAgo(new Date(Date.now() - 29 * 24 * 60 * 60_000))).toBe("29d");
  });

  it("returns months for 30-364 days ago", () => {
    expect(timeAgo(new Date(Date.now() - 30 * 24 * 60 * 60_000))).toBe("1mo");
    expect(timeAgo(new Date(Date.now() - 180 * 24 * 60 * 60_000))).toBe("6mo");
  });

  it("returns years for 365+ days ago", () => {
    expect(timeAgo(new Date(Date.now() - 365 * 24 * 60 * 60_000))).toBe("1y");
    expect(timeAgo(new Date(Date.now() - 730 * 24 * 60 * 60_000))).toBe("2y");
  });
});
