import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/arachnid-shield", () => ({
  scanImageBuffer: vi.fn().mockResolvedValue({ safe: true }),
  quarantineUpload: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  uploadLimiter: {},
  apiLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/cache", () => ({
  invalidate: vi.fn(),
  cacheKeys: {
    userProfile: (username: string) => `userProfile:${username}`,
  },
}));

vi.mock("@/lib/image-convert", () => ({
  isConvertibleImage: vi.fn().mockReturnValue(false),
  convertToWebP: vi.fn(),
}));

vi.mock("@/lib/limits", () => ({
  getLimitsForTier: vi.fn().mockReturnValue({
    maxImageSize: 5 * 1024 * 1024,
    maxVideoSize: 50 * 1024 * 1024,
    maxAudioSize: 10 * 1024 * 1024,
    maxDocumentSize: 10 * 1024 * 1024,
  }),
  formatSizeLimit: vi.fn().mockReturnValue("5MB"),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put, del } from "@vercel/blob";

const mockAuth = vi.mocked(auth);
const mockPrisma = vi.mocked(prisma);
const mockPut = vi.mocked(put);
const mockDel = vi.mocked(del);

function createMockFile(name: string, type: string, size: number) {
  const content = new Uint8Array(size);
  return {
    name,
    type,
    size,
    arrayBuffer: () => Promise.resolve(content.buffer),
  } as unknown as File;
}

/**
 * Create a request whose .formData() resolves directly to a mock FormData,
 * bypassing body serialization which hangs in jsdom.
 */
function createPostRequest(url: string, file?: File) {
  const mockFd = { get: (key: string) => (key === "file" ? (file ?? null) : null) };
  return {
    formData: async () => mockFd,
    headers: new Headers(),
  } as unknown as NextRequest;
}

describe("Avatar Upload API (/api/avatar)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/avatar/route");
    const res = await POST(createPostRequest("http://localhost/api/avatar", createMockFile("test.jpg", "image/jpeg", 1000)));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("rejects requests without a file", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const { POST } = await import("@/app/api/avatar/route");
    const res = await POST(createPostRequest("http://localhost/api/avatar"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("No file provided");
  });

  it("rejects invalid file types", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const { POST } = await import("@/app/api/avatar/route");
    const res = await POST(createPostRequest("http://localhost/api/avatar", createMockFile("test.pdf", "application/pdf", 1000)));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("JPEG, PNG, GIF, or WebP");
  });

  it("rejects files over 10MB", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const { POST } = await import("@/app/api/avatar/route");
    const res = await POST(createPostRequest("http://localhost/api/avatar", createMockFile("big.jpg", "image/jpeg", 11 * 1024 * 1024)));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("10MB");
  });

  it("uploads successfully and cleans up old blob avatar", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPut.mockResolvedValueOnce({
      url: "https://blob.vercel-storage.com/avatars/user1-new.jpg",
    } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      avatar: "https://abc.public.blob.vercel-storage.com/avatars/user1-old.jpg",
    } as never);
    mockPrisma.user.update.mockResolvedValueOnce({} as never);

    const { POST } = await import("@/app/api/avatar/route");
    const res = await POST(createPostRequest("http://localhost/api/avatar", createMockFile("photo.jpg", "image/jpeg", 100_000)));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeDefined();
    expect(mockDel).toHaveBeenCalled();
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });
});

describe("Generic Upload API (/api/upload)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(
      createPostRequest("http://localhost/api/upload", createMockFile("test.jpg", "image/jpeg", 1000)) as unknown as Request
    );
    expect(res.status).toBe(401);
  });

  it("rejects invalid file types", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(
      createPostRequest("http://localhost/api/upload", createMockFile("test.txt", "text/plain", 100)) as unknown as Request
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid file type");
  });

  it("rejects files over 5MB", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);

    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(
      createPostRequest("http://localhost/api/upload", createMockFile("big.png", "image/png", 6 * 1024 * 1024)) as unknown as Request
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("5MB");
  });

  it("accepts SVG uploads (unlike avatar)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPut.mockResolvedValueOnce({
      url: "https://blob.vercel-storage.com/uploads/user1-123.svg",
    } as never);

    const { POST } = await import("@/app/api/upload/route");
    const res = await POST(
      createPostRequest("http://localhost/api/upload", createMockFile("diagram.svg", "image/svg+xml", 1000)) as unknown as Request
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeDefined();
  });
});

describe("Username Check API (/api/username-check)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unavailable when no username provided", async () => {
    const { GET } = await import("@/app/api/username-check/route");

    const req = new NextRequest("http://localhost/api/username-check");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns unavailable for invalid format", async () => {
    const { GET } = await import("@/app/api/username-check/route");

    const req = new NextRequest("http://localhost/api/username-check?username=a!");
    const res = await GET(req);
    const body = await res.json();
    expect(body.available).toBe(false);
  });

  it("returns available when username is not taken", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce(null as never);

    const { GET } = await import("@/app/api/username-check/route");

    const req = new NextRequest("http://localhost/api/username-check?username=newname");
    const res = await GET(req);
    const body = await res.json();
    expect(body.available).toBe(true);
  });

  it("returns unavailable when taken by another user", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "other-user" } as never);

    const { GET } = await import("@/app/api/username-check/route");

    const req = new NextRequest("http://localhost/api/username-check?username=taken");
    const res = await GET(req);
    const body = await res.json();
    expect(body.available).toBe(false);
  });

  it("returns available when owned by current user", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "user1" } } as never);
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: "user1" } as never);

    const { GET } = await import("@/app/api/username-check/route");

    const req = new NextRequest("http://localhost/api/username-check?username=myname");
    const res = await GET(req);
    const body = await res.json();
    expect(body.available).toBe(true);
  });
});
