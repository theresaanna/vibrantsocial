import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    quarantinedUpload: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

function makeXmlResponse(code: number, description: string, reportId?: number) {
  return `<?xml version="1.0"?>
<reportResponse>
  <responseCode>${code}</responseCode>
  <responseDescription>${description}</responseDescription>
  ${reportId !== undefined ? `<reportId>${reportId}</reportId>` : ""}
</reportResponse>`;
}

async function loadModule() {
  vi.resetModules();
  vi.mock("@/lib/prisma", () => ({
    prisma: {
      quarantinedUpload: {
        update: vi.fn(),
      },
    },
  }));
  vi.mock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  }));
  return import("@/lib/ncmec-report");
}

const baseParams = {
  quarantinedUploadId: "q-1",
  userId: "user-1",
  username: "testuser",
  email: "test@example.com",
  classification: "csam",
  sha256: "abc123def",
  fileName: "photo.jpg",
  fileSize: 2048,
  mimeType: "image/jpeg",
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0",
  imageBuffer: Buffer.from("fake-image-data"),
  incidentDateTime: new Date("2026-01-15T10:30:00Z"),
};

describe("submitNCMECReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    process.env.NCMEC_USERNAME = "ncmec-user";
    process.env.NCMEC_PASSWORD = "ncmec-pass";
    process.env.NCMEC_ENVIRONMENT = "test";
  });

  it("completes the full submit → upload → fileinfo → finish workflow", async () => {
    const { submitNCMECReport } = await loadModule();
    const { prisma } = await import("@/lib/prisma");

    vi.mocked(fetch)
      // Step 1: submit
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success", 12345)),
      } as unknown as Response)
      // Step 2: upload
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success", 67890)),
      } as unknown as Response)
      // Step 3: fileinfo
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success")),
      } as unknown as Response)
      // Step 4: finish
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success")),
      } as unknown as Response);

    const result = await submitNCMECReport(baseParams);

    expect(result.reportId).toBe(12345);

    // Verify all 4 API calls were made
    expect(fetch).toHaveBeenCalledTimes(4);

    // Step 1: submit
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://exttest.cybertip.org/ispws/submit",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/xml",
        }),
      })
    );

    // Step 2: upload
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "https://exttest.cybertip.org/ispws/upload?id=12345&filename=photo.jpg",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "image/jpeg",
        }),
      })
    );

    // Step 3: fileinfo
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://exttest.cybertip.org/ispws/fileinfo?id=12345",
      expect.objectContaining({ method: "POST" })
    );

    // Step 4: finish
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "https://exttest.cybertip.org/ispws/finish?id=12345",
      expect.objectContaining({ method: "POST" })
    );

    // Verify database was updated
    expect(prisma.quarantinedUpload.update).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: {
        ncmecReportId: 12345,
        ncmecReportedAt: expect.any(Date),
      },
    });
  });

  it("uses production URL when NCMEC_ENVIRONMENT is not test", async () => {
    process.env.NCMEC_ENVIRONMENT = "production";

    const { submitNCMECReport } = await loadModule();

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success", 1)),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success", 2)),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success")),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success")),
      } as unknown as Response);

    await submitNCMECReport(baseParams);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "https://report.cybertip.org/ispws/submit",
      expect.any(Object)
    );
  });

  it("throws when submit returns non-zero response code", async () => {
    const { submitNCMECReport } = await loadModule();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(makeXmlResponse(4001, "Validation error")),
    } as unknown as Response);

    await expect(submitNCMECReport(baseParams)).rejects.toThrow(
      "NCMEC submit failed: Validation error"
    );
  });

  it("throws when HTTP request fails", async () => {
    const { submitNCMECReport } = await loadModule();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    } as unknown as Response);

    await expect(submitNCMECReport(baseParams)).rejects.toThrow(
      "NCMEC API error 401: Unauthorized"
    );
  });

  it("retracts report if upload step fails", async () => {
    const { submitNCMECReport } = await loadModule();

    vi.mocked(fetch)
      // submit succeeds
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success", 55555)),
      } as unknown as Response)
      // upload fails
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(4000, "Upload failed")),
      } as unknown as Response)
      // retract call
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Retracted")),
      } as unknown as Response);

    await expect(submitNCMECReport(baseParams)).rejects.toThrow(
      "NCMEC upload failed: Upload failed"
    );

    // Verify retract was called
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "https://exttest.cybertip.org/ispws/retract?id=55555",
      expect.any(Object)
    );
  });

  it("sends correct Basic auth header", async () => {
    const { submitNCMECReport } = await loadModule();

    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success", 1)),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success", 2)),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success")),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(makeXmlResponse(0, "Success")),
      } as unknown as Response);

    await submitNCMECReport(baseParams);

    const expectedAuth =
      "Basic " + Buffer.from("ncmec-user:ncmec-pass").toString("base64");
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expectedAuth,
        }),
      })
    );
  });
});

describe("isNCMECConfigured", () => {
  it("returns true when both credentials are set", async () => {
    process.env.NCMEC_USERNAME = "user";
    process.env.NCMEC_PASSWORD = "pass";
    const { isNCMECConfigured } = await loadModule();
    expect(isNCMECConfigured()).toBe(true);
  });

  it("returns false when username is missing", async () => {
    delete process.env.NCMEC_USERNAME;
    process.env.NCMEC_PASSWORD = "pass";
    const { isNCMECConfigured } = await loadModule();
    expect(isNCMECConfigured()).toBe(false);
  });

  it("returns false when password is missing", async () => {
    process.env.NCMEC_USERNAME = "user";
    delete process.env.NCMEC_PASSWORD;
    const { isNCMECConfigured } = await loadModule();
    expect(isNCMECConfigured()).toBe(false);
  });
});

describe("checkNCMECStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    process.env.NCMEC_USERNAME = "user";
    process.env.NCMEC_PASSWORD = "pass";
    process.env.NCMEC_ENVIRONMENT = "test";
  });

  it("returns true when API responds OK", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);
    const { checkNCMECStatus } = await loadModule();
    expect(await checkNCMECStatus()).toBe(true);
  });

  it("returns false when API responds with error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
    const { checkNCMECStatus } = await loadModule();
    expect(await checkNCMECStatus()).toBe(false);
  });

  it("returns false when fetch throws", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));
    const { checkNCMECStatus } = await loadModule();
    expect(await checkNCMECStatus()).toBe(false);
  });
});
