import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the encryption key environment variable
vi.stubEnv("TWO_FACTOR_ENCRYPTION_KEY", "a]b]c]d]e]f]0]1]2]3]4]5]6]7]8]9]a]b]c]d]e]f]0]1]2]3]4]5]6]7]8]9".replace(/]/g, ""));
// Actually use a proper 64-char hex key
beforeEach(() => {
  process.env.TWO_FACTOR_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

import {
  encryptSecret,
  decryptSecret,
  generateTOTPSecret,
  getTOTPUri,
  verifyTOTPCode,
  generateBackupCodes,
  hashBackupCodes,
  verifyBackupCode,
} from "@/lib/two-factor";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a secret through encryption", () => {
    const original = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptSecret(original);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const a = encryptSecret(secret);
    const b = encryptSecret(secret);
    expect(a).not.toBe(b);
    // Both should decrypt to the same value
    expect(decryptSecret(a)).toBe(secret);
    expect(decryptSecret(b)).toBe(secret);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptSecret("mysecret");
    const parts = encrypted.split(":");
    // Tamper with the ciphertext
    parts[1] = Buffer.from("tampered").toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("throws when encryption key is missing", () => {
    const savedKey = process.env.TWO_FACTOR_ENCRYPTION_KEY;
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
    expect(() => encryptSecret("test")).toThrow("TWO_FACTOR_ENCRYPTION_KEY");
    process.env.TWO_FACTOR_ENCRYPTION_KEY = savedKey;
  });
});

describe("generateTOTPSecret", () => {
  it("returns a base32-encoded string", () => {
    const secret = generateTOTPSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it("generates unique secrets", () => {
    const secrets = new Set(Array.from({ length: 10 }, () => generateTOTPSecret()));
    expect(secrets.size).toBe(10);
  });
});

describe("getTOTPUri", () => {
  it("returns a valid otpauth URI", () => {
    const uri = getTOTPUri("JBSWY3DPEHPK3PXP", "user@example.com");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("VibrantSocial");
    expect(uri).toContain("user%40example.com");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
  });
});

describe("verifyTOTPCode", () => {
  it("accepts a valid current code", () => {
    const { TOTP } = require("otpauth");
    const secret = "JBSWY3DPEHPK3PXP";
    const totp = new TOTP({
      secret,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });
    const currentCode = totp.generate();
    expect(verifyTOTPCode(secret, currentCode)).toBe(true);
  });

  it("rejects an incorrect code", () => {
    expect(verifyTOTPCode("JBSWY3DPEHPK3PXP", "000000")).toBe(false);
  });

  it("rejects empty code", () => {
    expect(verifyTOTPCode("JBSWY3DPEHPK3PXP", "")).toBe(false);
  });

  it("rejects non-numeric code", () => {
    expect(verifyTOTPCode("JBSWY3DPEHPK3PXP", "abcdef")).toBe(false);
  });
});

describe("generateBackupCodes", () => {
  it("generates the requested number of codes", () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
  });

  it("generates codes in xxxx-xxxx format", () => {
    const codes = generateBackupCodes(5);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
    }
  });

  it("generates unique codes", () => {
    const codes = generateBackupCodes(10);
    expect(new Set(codes).size).toBe(10);
  });

  it("defaults to 10 codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
  });
});

describe("hashBackupCodes / verifyBackupCode", () => {
  it("verifies a correct backup code", async () => {
    const codes = ["abcd-ef01"];
    const hashed = await hashBackupCodes(codes);
    expect(hashed).toHaveLength(1);
    const idx = await verifyBackupCode("abcd-ef01", hashed);
    expect(idx).toBe(0);
  });

  it("verifies code without the dash", async () => {
    const codes = ["abcd-ef01"];
    const hashed = await hashBackupCodes(codes);
    const idx = await verifyBackupCode("abcdef01", hashed);
    expect(idx).toBe(0);
  });

  it("returns -1 for invalid code", async () => {
    const hashed = await hashBackupCodes(["abcd-ef01"]);
    const idx = await verifyBackupCode("wrong-code", hashed);
    expect(idx).toBe(-1);
  });

  it("returns correct index for multiple codes", async () => {
    const codes = ["aaaa-bbbb", "cccc-dddd", "eeee-ffff"];
    const hashed = await hashBackupCodes(codes);
    const idx = await verifyBackupCode("cccc-dddd", hashed);
    expect(idx).toBe(1);
  });

  it("is case-insensitive", async () => {
    const codes = ["abcd-ef01"];
    const hashed = await hashBackupCodes(codes);
    const idx = await verifyBackupCode("ABCD-EF01", hashed);
    expect(idx).toBe(0);
  });
});
