import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@vercel/blob/client", () => ({
  handleUpload: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  uploadLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

import { auth } from "@/auth";
import { handleUpload } from "@vercel/blob/client";
import { checkRateLimit } from "@/lib/rate-limit";
import { POST } from "@/app/api/upload/digital-file/route";

const mockAuth = vi.mocked(auth);
const mockHandleUpload = vi.mocked(handleUpload);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

function createRequest(body: object = {}): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request;
}

describe("POST /api/upload/digital-file", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated requests", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const res = await POST(createRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects when rate limited", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockCheckRateLimit.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Rate limited" }), { status: 429 }) as never,
    );

    const res = await POST(createRequest());
    expect(res.status).toBe(429);
  });

  it("delegates to handleUpload for authenticated requests", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockHandleUpload.mockResolvedValueOnce({ type: "blob.generate-client-token", clientToken: "token-123" } as never);

    const req = createRequest({ type: "blob.generate-client-token", payload: {} });
    const res = await POST(req);

    expect(mockHandleUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.any(Object),
        request: req,
      }),
    );
    const body = await res.json();
    expect(body.clientToken).toBe("token-123");
  });

  it("configures 200MB max size in token generation", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: "u1" } } as never);
    mockHandleUpload.mockImplementation(async ({ onBeforeGenerateToken }) => {
      const tokenConfig = await onBeforeGenerateToken!("test-file.zip", undefined);
      expect(tokenConfig.maximumSizeInBytes).toBe(200 * 1024 * 1024);
      expect(tokenConfig.addRandomSuffix).toBe(true);
      const payload = JSON.parse(tokenConfig.tokenPayload as string);
      expect(payload.userId).toBe("u1");
      expect(payload.category).toBe("digital-file");
      return {} as never;
    });

    await POST(createRequest({ type: "blob.generate-client-token", payload: {} }));
    expect(mockHandleUpload).toHaveBeenCalled();
  });
});
