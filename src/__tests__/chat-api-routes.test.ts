import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("ably", () => ({
  default: {
    Rest: vi.fn().mockImplementation(() => ({
      auth: {
        createTokenRequest: vi
          .fn()
          .mockResolvedValue({ token: "mock-token", clientId: "user1" }),
      },
    })),
  },
}));

import { auth } from "@/auth";
import { GET } from "@/app/api/ably-token/route";

const mockAuth = vi.mocked(auth);

describe("Ably Token API (/api/ably-token)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unauthenticated requests", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    const response = await GET();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns token request for authenticated user", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user1" },
    } as never);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("token");
  });
});
