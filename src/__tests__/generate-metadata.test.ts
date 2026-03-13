import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all page dependencies that aren't needed for metadata generation
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("next/link", () => ({ default: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    post: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    repost: { findUnique: vi.fn(), findMany: vi.fn() },
    tag: { findUnique: vi.fn() },
    follow: { findUnique: vi.fn() },
    closeFriend: { findUnique: vi.fn() },
    tagSubscription: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/cache", () => ({
  cached: vi.fn((_key: string, fn: () => unknown) => fn()),
  cacheKeys: {
    userProfile: (username: string) => `user:${username}`,
  },
}));

// Mock component imports that the pages reference
vi.mock("@/components/post-card", () => ({ PostCard: vi.fn() }));
vi.mock("@/components/follow-button", () => ({ FollowButton: vi.fn() }));
vi.mock("@/components/friend-button", () => ({ FriendButton: vi.fn() }));
vi.mock("@/components/subscribe-button", () => ({ SubscribeButton: vi.fn() }));
vi.mock("@/components/profile-share-button", () => ({ ProfileShareButton: vi.fn() }));
vi.mock("@/components/bio-content", () => ({ BioContent: vi.fn() }));
vi.mock("@/components/profile-tabs", () => ({ ProfileTabs: vi.fn() }));
vi.mock("@/components/repost-card", () => ({ RepostCard: vi.fn() }));
vi.mock("@/components/user-list", () => ({ UserList: vi.fn() }));
vi.mock("@/app/feed/friend-actions", () => ({
  getFriendshipStatus: vi.fn(),
}));
vi.mock("@/app/feed/subscription-actions", () => ({
  isSubscribedToUser: vi.fn(),
}));
vi.mock("@/app/feed/follow-actions", () => ({
  getFollowers: vi.fn(),
  getFollowing: vi.fn(),
}));
vi.mock("@/lib/profile-themes", () => ({
  generateAdaptiveTheme: vi.fn(),
}));
vi.mock("@/lib/require-profile", () => ({
  isProfileIncomplete: vi.fn(),
}));
vi.mock("@/app/post/[id]/post-page-client", () => ({ PostPageClient: vi.fn() }));
vi.mock("@/app/quote/[id]/quote-page-client", () => ({ QuotePageClient: vi.fn() }));
vi.mock("@/app/feed/feed-queries", () => ({
  getPostInclude: vi.fn(() => ({})),
}));
vi.mock("@/app/tags/actions", () => ({
  getPostsByTag: vi.fn(),
}));
vi.mock("@/app/tag/[name]/tag-post-list", () => ({ TagPostList: vi.fn() }));
vi.mock("@/app/tag/[name]/tag-subscribe-button", () => ({ TagSubscribeButton: vi.fn() }));

import { prisma } from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => vi.clearAllMocks());

describe("profile page generateMetadata", () => {
  it("returns metadata for a user with bio", async () => {
    const { generateMetadata } = await import("@/app/[username]/page");

    mockPrisma.user.findUnique.mockResolvedValue({
      username: "alice",
      displayName: "Alice W",
      name: "Alice",
      bio: "I love coding and cats.",
      avatar: "https://example.com/alice.jpg",
      image: null,
      _count: { followers: 42, posts: 10 },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ username: "alice" }),
      searchParams: Promise.resolve({}),
    });

    expect(result.title).toBe("Alice W (@alice)");
    expect(result.description).toBe("I love coding and cats.");
    expect(result.openGraph?.images).toEqual([
      { url: "https://example.com/alice.jpg", alt: "Alice W's avatar" },
    ]);
  });

  it("generates description from stats when no bio", async () => {
    const { generateMetadata } = await import("@/app/[username]/page");

    mockPrisma.user.findUnique.mockResolvedValue({
      username: "bob",
      displayName: null,
      name: "Bob",
      bio: null,
      avatar: null,
      image: null,
      _count: { followers: 5, posts: 3 },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ username: "bob" }),
      searchParams: Promise.resolve({}),
    });

    expect(result.title).toBe("Bob (@bob)");
    expect(result.description).toContain("3 posts");
    expect(result.description).toContain("5 followers");
  });

  it("returns fallback for non-existent user", async () => {
    const { generateMetadata } = await import("@/app/[username]/page");

    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await generateMetadata({
      params: Promise.resolve({ username: "nobody" }),
      searchParams: Promise.resolve({}),
    });

    expect(result.title).toBe("User Not Found");
  });

  it("falls back to username when displayName and name are null", async () => {
    const { generateMetadata } = await import("@/app/[username]/page");

    mockPrisma.user.findUnique.mockResolvedValue({
      username: "user1",
      displayName: null,
      name: null,
      bio: null,
      avatar: null,
      image: null,
      _count: { followers: 0, posts: 0 },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ username: "user1" }),
      searchParams: Promise.resolve({}),
    });

    expect(result.title).toBe("user1 (@user1)");
  });

  it("uses image as fallback when avatar is null", async () => {
    const { generateMetadata } = await import("@/app/[username]/page");

    mockPrisma.user.findUnique.mockResolvedValue({
      username: "charlie",
      displayName: "Charlie",
      name: null,
      bio: "Hi",
      avatar: null,
      image: "https://example.com/google-avatar.jpg",
      _count: { followers: 0, posts: 0 },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ username: "charlie" }),
      searchParams: Promise.resolve({}),
    });

    expect(result.openGraph?.images).toEqual([
      { url: "https://example.com/google-avatar.jpg", alt: "Charlie's avatar" },
    ]);
  });
});

describe("post page generateMetadata", () => {
  it("returns metadata for a post with text content", async () => {
    const { generateMetadata } = await import("@/app/post/[id]/page");

    mockPrisma.post.findUnique.mockResolvedValue({
      id: "post-1",
      content: JSON.stringify({
        root: {
          children: [
            {
              children: [{ type: "text", text: "Hello world, this is my first post!" }],
              type: "paragraph",
            },
          ],
        },
      }),
      author: {
        username: "alice",
        displayName: "Alice",
        name: null,
        avatar: "https://example.com/alice.jpg",
        image: null,
      },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ id: "post-1" }),
      searchParams: Promise.resolve({}),
    });

    expect(result.title).toBe("Alice on VibrantSocial");
    expect(result.description).toBe("Hello world, this is my first post!");
    expect(result.openGraph?.images).toEqual([
      { url: "https://example.com/alice.jpg", alt: "Post by Alice" },
    ]);
  });

  it("uses first image from post content as OG image", async () => {
    const { generateMetadata } = await import("@/app/post/[id]/page");

    mockPrisma.post.findUnique.mockResolvedValue({
      id: "post-2",
      content: JSON.stringify({
        root: {
          children: [
            {
              children: [
                { type: "text", text: "Check this out" },
                { type: "image", src: "https://example.com/photo.jpg" },
              ],
              type: "paragraph",
            },
          ],
        },
      }),
      author: {
        username: "alice",
        displayName: "Alice",
        name: null,
        avatar: "https://example.com/alice.jpg",
        image: null,
      },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ id: "post-2" }),
      searchParams: Promise.resolve({}),
    });

    expect(result.openGraph?.images).toEqual([
      { url: "https://example.com/photo.jpg", alt: "Post by Alice" },
    ]);
  });

  it("returns fallback for non-existent post", async () => {
    const { generateMetadata } = await import("@/app/post/[id]/page");

    mockPrisma.post.findUnique.mockResolvedValue(null);

    const result = await generateMetadata({
      params: Promise.resolve({ id: "nonexistent" }),
      searchParams: Promise.resolve({}),
    });

    expect(result.title).toBe("Post Not Found");
  });

  it("generates fallback description when post has no text", async () => {
    const { generateMetadata } = await import("@/app/post/[id]/page");

    mockPrisma.post.findUnique.mockResolvedValue({
      id: "post-3",
      content: JSON.stringify({ root: { children: [] } }),
      author: {
        username: "bob",
        displayName: null,
        name: "Bob",
        avatar: null,
        image: null,
      },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ id: "post-3" }),
      searchParams: Promise.resolve({}),
    });

    expect(result.description).toContain("A post by Bob");
  });

  it("truncates long post content for description", async () => {
    const { generateMetadata } = await import("@/app/post/[id]/page");

    const longText = "a".repeat(300);
    mockPrisma.post.findUnique.mockResolvedValue({
      id: "post-4",
      content: JSON.stringify({
        root: {
          children: [
            { children: [{ type: "text", text: longText }], type: "paragraph" },
          ],
        },
      }),
      author: {
        username: "alice",
        displayName: "Alice",
        name: null,
        avatar: null,
        image: null,
      },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ id: "post-4" }),
      searchParams: Promise.resolve({}),
    });

    expect(result.description!.length).toBeLessThanOrEqual(160);
    expect(result.description!.endsWith("\u2026")).toBe(true);
  });
});

describe("quote page generateMetadata", () => {
  it("returns metadata for a quote post", async () => {
    const { generateMetadata } = await import("@/app/quote/[id]/page");

    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "quote-1",
      content: JSON.stringify({
        root: {
          children: [
            {
              children: [{ type: "text", text: "Great take on this topic!" }],
              type: "paragraph",
            },
          ],
        },
      }),
      user: {
        username: "dave",
        displayName: "Dave",
        name: null,
        avatar: "https://example.com/dave.jpg",
        image: null,
      },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ id: "quote-1" }),
    });

    expect(result.title).toBe("Dave on VibrantSocial");
    expect(result.description).toBe("Great take on this topic!");
    expect(result.openGraph?.images).toEqual([
      { url: "https://example.com/dave.jpg", alt: "Quote by Dave" },
    ]);
  });

  it("returns fallback for non-existent quote", async () => {
    const { generateMetadata } = await import("@/app/quote/[id]/page");

    mockPrisma.repost.findUnique.mockResolvedValue(null);

    const result = await generateMetadata({
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(result.title).toBe("Quote Not Found");
  });

  it("returns fallback for repost without content", async () => {
    const { generateMetadata } = await import("@/app/quote/[id]/page");

    mockPrisma.repost.findUnique.mockResolvedValue({
      id: "repost-1",
      content: null,
      user: { username: "eve", displayName: "Eve", name: null, avatar: null, image: null },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ id: "repost-1" }),
    });

    expect(result.title).toBe("Quote Not Found");
  });
});

describe("tag page generateMetadata", () => {
  it("returns metadata for a tag with posts", async () => {
    const { generateMetadata } = await import("@/app/tag/[name]/page");

    mockPrisma.tag.findUnique.mockResolvedValue({
      name: "photography",
      _count: { posts: 42 },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ name: "photography" }),
    });

    expect(result.title).toBe("#photography");
    expect(result.description).toContain("42 posts");
    expect(result.description).toContain("#photography");
  });

  it("uses singular 'post' for count of 1", async () => {
    const { generateMetadata } = await import("@/app/tag/[name]/page");

    mockPrisma.tag.findUnique.mockResolvedValue({
      name: "rare",
      _count: { posts: 1 },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ name: "rare" }),
    });

    expect(result.description).toContain("1 post ");
  });

  it("returns fallback for non-existent tag", async () => {
    const { generateMetadata } = await import("@/app/tag/[name]/page");

    mockPrisma.tag.findUnique.mockResolvedValue(null);

    const result = await generateMetadata({
      params: Promise.resolve({ name: "nonexistent" }),
    });

    expect(result.title).toBe("Tag Not Found");
  });

  it("decodes URL-encoded tag names", async () => {
    const { generateMetadata } = await import("@/app/tag/[name]/page");

    mockPrisma.tag.findUnique.mockResolvedValue({
      name: "c++",
      _count: { posts: 5 },
    } as never);

    const result = await generateMetadata({
      params: Promise.resolve({ name: "c%2B%2B" }),
    });

    expect(result.title).toBe("#c++");
  });
});

describe("followers page generateMetadata", () => {
  it("returns metadata with username", async () => {
    const { generateMetadata } = await import("@/app/[username]/followers/page");

    const result = await generateMetadata({
      params: Promise.resolve({ username: "alice" }),
    });

    expect(result.title).toBe("People following @alice");
    expect(result.description).toContain("@alice");
    expect(result.robots).toEqual({ index: false, follow: false });
  });
});

describe("following page generateMetadata", () => {
  it("returns metadata with username", async () => {
    const { generateMetadata } = await import("@/app/[username]/following/page");

    const result = await generateMetadata({
      params: Promise.resolve({ username: "alice" }),
    });

    expect(result.title).toBe("People @alice follows");
    expect(result.description).toContain("@alice");
    expect(result.robots).toEqual({ index: false, follow: false });
  });
});
