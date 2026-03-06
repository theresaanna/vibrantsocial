import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPost, deletePost } from "@/app/feed/actions";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/phone-gate", () => ({
  requirePhoneVerification: vi.fn(),
}));

vi.mock("@/lib/age-gate", () => ({
  requireMinimumAge: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireMinimumAge } from "@/lib/age-gate";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockPhoneGate = vi.mocked(requirePhoneVerification);
const mockAgeGate = vi.mocked(requireMinimumAge);

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(data)) {
    fd.set(key, value);
  }
  return fd;
}

const prevState = { success: false, message: "" };

// A valid Lexical JSON content string (> 50 chars when stringified)
const validLexicalContent = JSON.stringify({
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "This is a test post with enough content to pass validation",
            type: "text",
            version: 1,
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
    ],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
});

describe("createPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await createPost(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("requires phone verification", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(false);

    const result = await createPost(prevState, makeFormData({ content: validLexicalContent }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Phone verification required to post");
  });

  it("requires minimum age of 18 to post", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockAgeGate.mockResolvedValueOnce(false);

    const result = await createPost(prevState, makeFormData({ content: validLexicalContent }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("You must be 18 or older to post");
    expect(mockAgeGate).toHaveBeenCalledWith("user1", 18);
  });

  it("requires content to be present", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockAgeGate.mockResolvedValueOnce(true);

    const result = await createPost(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Post content is required");
  });

  it("requires valid JSON content", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockAgeGate.mockResolvedValueOnce(true);

    const result = await createPost(
      prevState,
      makeFormData({ content: "not valid json" })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Invalid post content");
  });

  it("rejects posts that are too short (< 50 chars when stringified)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockAgeGate.mockResolvedValueOnce(true);

    const shortContent = JSON.stringify({ root: { type: "root" } });
    const result = await createPost(
      prevState,
      makeFormData({ content: shortContent })
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("Post cannot be empty");
  });

  it("creates post successfully with valid content", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockAgeGate.mockResolvedValueOnce(true);
    mockPrisma.post.create.mockResolvedValueOnce({} as never);

    const result = await createPost(
      prevState,
      makeFormData({ content: validLexicalContent })
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe("Post created");
    expect(mockPrisma.post.create).toHaveBeenCalledWith({
      data: { content: validLexicalContent, authorId: "user1", isSensitive: false, isNsfw: false },
    });
  });

  it("creates post with isSensitive flag", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockAgeGate.mockResolvedValueOnce(true);
    mockPrisma.post.create.mockResolvedValueOnce({} as never);

    const result = await createPost(
      prevState,
      makeFormData({ content: validLexicalContent, isSensitive: "true" })
    );
    expect(result.success).toBe(true);
    expect(mockPrisma.post.create).toHaveBeenCalledWith({
      data: { content: validLexicalContent, authorId: "user1", isSensitive: true, isNsfw: false },
    });
  });

  it("creates post with isNsfw flag", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockAgeGate.mockResolvedValueOnce(true);
    mockPrisma.post.create.mockResolvedValueOnce({} as never);

    const result = await createPost(
      prevState,
      makeFormData({ content: validLexicalContent, isNsfw: "true" })
    );
    expect(result.success).toBe(true);
    expect(mockPrisma.post.create).toHaveBeenCalledWith({
      data: { content: validLexicalContent, authorId: "user1", isSensitive: false, isNsfw: true },
    });
  });

  it("defaults isSensitive and isNsfw to false when not provided", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPhoneGate.mockResolvedValueOnce(true);
    mockAgeGate.mockResolvedValueOnce(true);
    mockPrisma.post.create.mockResolvedValueOnce({} as never);

    await createPost(prevState, makeFormData({ content: validLexicalContent }));
    expect(mockPrisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isSensitive: false, isNsfw: false }),
      })
    );
  });
});

describe("deletePost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const result = await deletePost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authenticated");
  });

  it("requires post ID", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    const result = await deletePost(prevState, makeFormData({}));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Post ID required");
  });

  it("rejects deletion of non-existent post", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce(null as never);

    const result = await deletePost(prevState, makeFormData({ postId: "nonexistent" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });

  it("rejects deletion by non-author", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      id: "p1",
      authorId: "other-user",
    } as never);

    const result = await deletePost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(false);
    expect(result.message).toBe("Not authorized");
  });

  it("deletes post when authorized", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.post.findUnique.mockResolvedValueOnce({
      id: "p1",
      authorId: "user1",
    } as never);
    mockPrisma.post.delete.mockResolvedValueOnce({} as never);

    const result = await deletePost(prevState, makeFormData({ postId: "p1" }));
    expect(result.success).toBe(true);
    expect(result.message).toBe("Post deleted");
    expect(mockPrisma.post.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });
});
