import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// --------------------------------------------------------------------------
// Mocks
// --------------------------------------------------------------------------

const mockBeginTOTPSetup = vi.fn();
const mockConfirmTOTPSetup = vi.fn();
const mockDisableTwoFactor = vi.fn();
const mockRegenerateBackupCodes = vi.fn();
const mockListPasskeys = vi.fn();
const mockGeneratePasskeyRegistrationOptions = vi.fn();
const mockVerifyPasskeyRegistration = vi.fn();
const mockRemovePasskey = vi.fn();
const mockRenamePasskey = vi.fn();

vi.mock("@/app/profile/two-factor-actions", () => ({
  beginTOTPSetup: (...args: unknown[]) => mockBeginTOTPSetup(...args),
  confirmTOTPSetup: (...args: unknown[]) => mockConfirmTOTPSetup(...args),
  disableTwoFactor: (...args: unknown[]) => mockDisableTwoFactor(...args),
  regenerateBackupCodes: (...args: unknown[]) => mockRegenerateBackupCodes(...args),
}));

vi.mock("@/app/profile/passkey-actions", () => ({
  generatePasskeyRegistrationOptions: (...args: unknown[]) =>
    mockGeneratePasskeyRegistrationOptions(...args),
  verifyPasskeyRegistration: (...args: unknown[]) =>
    mockVerifyPasskeyRegistration(...args),
  listPasskeys: (...args: unknown[]) => mockListPasskeys(...args),
  removePasskey: (...args: unknown[]) => mockRemovePasskey(...args),
  renamePasskey: (...args: unknown[]) => mockRenamePasskey(...args),
}));

vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: vi.fn(),
}));

import { TwoFactorSection } from "@/app/profile/two-factor-section";

describe("TwoFactorSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPasskeys.mockResolvedValue([]);
  });

  it("renders nothing for non-credentials users", () => {
    const { container } = render(
      <TwoFactorSection twoFactorEnabled={false} isCredentialsUser={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows 'Not enabled' badge when 2FA is disabled", () => {
    render(
      <TwoFactorSection twoFactorEnabled={false} isCredentialsUser={true} />
    );
    expect(screen.getByText("Not enabled")).toBeInTheDocument();
    expect(screen.getByTestId("enable-2fa-button")).toBeInTheDocument();
  });

  it("shows 'Enabled' badge when 2FA is enabled", () => {
    render(
      <TwoFactorSection twoFactorEnabled={true} isCredentialsUser={true} />
    );
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByTestId("disable-2fa-button")).toBeInTheDocument();
  });

  it("starts TOTP setup when clicking enable button", async () => {
    mockBeginTOTPSetup.mockResolvedValueOnce({
      success: true,
      message: "",
      secret: "TESTBASE32SECRET",
      uri: "otpauth://totp/VibrantSocial:user@test.com?secret=TESTBASE32SECRET",
    });

    render(
      <TwoFactorSection twoFactorEnabled={false} isCredentialsUser={true} />
    );

    fireEvent.click(screen.getByTestId("enable-2fa-button"));

    await waitFor(() => {
      expect(screen.getByTestId("totp-qr-code")).toBeInTheDocument();
      expect(screen.getByTestId("totp-secret-display")).toHaveTextContent("TESTBASE32SECRET");
    });
  });

  it("shows error when setup fails", async () => {
    mockBeginTOTPSetup.mockResolvedValueOnce({
      success: false,
      message: "password-based account",
    });

    render(
      <TwoFactorSection twoFactorEnabled={false} isCredentialsUser={true} />
    );

    fireEvent.click(screen.getByTestId("enable-2fa-button"));

    await waitFor(() => {
      expect(screen.getByTestId("2fa-message")).toHaveTextContent("password-based account");
    });
  });

  it("verifies TOTP code and shows backup codes", async () => {
    // Start setup
    mockBeginTOTPSetup.mockResolvedValueOnce({
      success: true,
      message: "",
      secret: "SECRET",
      uri: "otpauth://totp/Test?secret=SECRET",
    });

    mockConfirmTOTPSetup.mockResolvedValueOnce({
      success: true,
      message: "enabled!",
      backupCodes: ["aaaa-bbbb", "cccc-dddd"],
    });

    render(
      <TwoFactorSection twoFactorEnabled={false} isCredentialsUser={true} />
    );

    // Click setup
    fireEvent.click(screen.getByTestId("enable-2fa-button"));
    await waitFor(() => {
      expect(screen.getByTestId("setup-totp-input")).toBeInTheDocument();
    });

    // Enter code
    fireEvent.change(screen.getByTestId("setup-totp-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("verify-totp-button"));

    await waitFor(() => {
      expect(screen.getByTestId("backup-codes-list")).toBeInTheDocument();
      expect(screen.getByText("aaaa-bbbb")).toBeInTheDocument();
      expect(screen.getByText("cccc-dddd")).toBeInTheDocument();
    });
  });

  it("shows invalid code error on verify failure", async () => {
    mockBeginTOTPSetup.mockResolvedValueOnce({
      success: true,
      message: "",
      secret: "SECRET",
      uri: "otpauth://totp/Test?secret=SECRET",
    });

    mockConfirmTOTPSetup.mockResolvedValueOnce({
      success: false,
      message: "Invalid code. Please try again.",
    });

    render(
      <TwoFactorSection twoFactorEnabled={false} isCredentialsUser={true} />
    );

    fireEvent.click(screen.getByTestId("enable-2fa-button"));
    await waitFor(() => {
      expect(screen.getByTestId("setup-totp-input")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("setup-totp-input"), {
      target: { value: "999999" },
    });
    fireEvent.click(screen.getByTestId("verify-totp-button"));

    await waitFor(() => {
      expect(screen.getByTestId("2fa-message")).toHaveTextContent("Invalid code");
    });
  });

  it("disables 2FA with password", async () => {
    mockDisableTwoFactor.mockResolvedValueOnce({
      success: true,
      message: "Two-factor authentication disabled.",
    });

    render(
      <TwoFactorSection twoFactorEnabled={true} isCredentialsUser={true} />
    );

    // Click disable button
    fireEvent.click(screen.getByTestId("disable-2fa-button"));

    await waitFor(() => {
      expect(screen.getByTestId("2fa-password-input")).toBeInTheDocument();
    });

    // Enter password and confirm
    fireEvent.change(screen.getByTestId("2fa-password-input"), {
      target: { value: "mypassword" },
    });
    fireEvent.click(screen.getByTestId("confirm-disable-2fa"));

    await waitFor(() => {
      expect(screen.getByText("Not enabled")).toBeInTheDocument();
    });
  });

  it("shows passkeys list when 2FA is enabled", async () => {
    mockListPasskeys.mockResolvedValueOnce([
      {
        id: "pk1",
        name: "MacBook Pro",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastUsedAt: null,
        deviceType: "multiDevice",
        backedUp: true,
      },
    ]);

    render(
      <TwoFactorSection twoFactorEnabled={true} isCredentialsUser={true} />
    );

    await waitFor(() => {
      expect(screen.getByText("MacBook Pro")).toBeInTheDocument();
      expect(screen.getByText("Synced")).toBeInTheDocument();
    });
  });

  it("copies backup codes to clipboard", async () => {
    mockBeginTOTPSetup.mockResolvedValueOnce({
      success: true,
      message: "",
      secret: "S",
      uri: "otpauth://totp/T?secret=S",
    });
    mockConfirmTOTPSetup.mockResolvedValueOnce({
      success: true,
      message: "enabled!",
      backupCodes: ["aaaa-bbbb"],
    });

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <TwoFactorSection twoFactorEnabled={false} isCredentialsUser={true} />
    );

    fireEvent.click(screen.getByTestId("enable-2fa-button"));
    await waitFor(() => screen.getByTestId("setup-totp-input"));

    fireEvent.change(screen.getByTestId("setup-totp-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("verify-totp-button"));

    await waitFor(() => screen.getByTestId("copy-backup-codes"));
    fireEvent.click(screen.getByTestId("copy-backup-codes"));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("aaaa-bbbb");
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });

  it("only allows numeric input for TOTP code", async () => {
    mockBeginTOTPSetup.mockResolvedValueOnce({
      success: true,
      message: "",
      secret: "S",
      uri: "otpauth://totp/T?secret=S",
    });

    render(
      <TwoFactorSection twoFactorEnabled={false} isCredentialsUser={true} />
    );

    fireEvent.click(screen.getByTestId("enable-2fa-button"));
    await waitFor(() => screen.getByTestId("setup-totp-input"));

    const input = screen.getByTestId("setup-totp-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc123def456" } });
    expect(input.value).toBe("123456");
  });
});
