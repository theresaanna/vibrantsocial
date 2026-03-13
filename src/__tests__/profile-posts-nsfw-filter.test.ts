import { describe, it, expect } from "vitest";
import { buildProfilePostsContentFilter } from "@/app/[username]/profile-queries";

describe("buildProfilePostsContentFilter", () => {
  it("returns empty filter for logged-out users", () => {
    const filter = buildProfilePostsContentFilter(undefined, false);
    expect(filter).toEqual({});
  });

  it("excludes NSFW posts when viewer has not opted in", () => {
    const filter = buildProfilePostsContentFilter("user1", false);
    expect(filter).toEqual({
      isSensitive: false,
      isNsfw: false,
      isGraphicNudity: false,
    });
  });

  it("includes NSFW posts when viewer has opted in", () => {
    const filter = buildProfilePostsContentFilter("user1", true);
    expect(filter).toEqual({
      isSensitive: false,
      isGraphicNudity: false,
    });
    expect(filter).not.toHaveProperty("isNsfw");
  });

  it("always excludes sensitive and graphic regardless of NSFW preference", () => {
    const filterOptedIn = buildProfilePostsContentFilter("user1", true);
    const filterOptedOut = buildProfilePostsContentFilter("user1", false);

    // Sensitive and graphic are always excluded from the posts tab
    expect(filterOptedIn).toHaveProperty("isSensitive", false);
    expect(filterOptedIn).toHaveProperty("isGraphicNudity", false);
    expect(filterOptedOut).toHaveProperty("isSensitive", false);
    expect(filterOptedOut).toHaveProperty("isGraphicNudity", false);
  });
});
