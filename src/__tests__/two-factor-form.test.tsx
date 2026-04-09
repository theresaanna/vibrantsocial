import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// --------------------------------------------------------------------------
// Mocks
// --------------------------------------------------------------------------

const mockVerifyTwoFactorLogin = vi.fn();
const mockVerifyBackupCodeLogin = vi.fn();
const mockVerifyPasskeyLogin = vi.fn();
const mockGetPasskeyAuthenticationOptions = vi.fn();
const mockHasPasskeysForPending = vi.fn();

vi.mock("@/app/login/two-factor/actions", () => ({
  verifyTwoFactorLogin: (...args: unknown[]) => mockVerifyTwoFactorLogin(...args),
  verifyBackupCodeLogin: (...args: unknown[]) => mockVerifyBackupCodeLogin(...args),
  verifyPasskeyLogin: (...args: unknown[]) => mockVerifyPasskeyLogin(...args),
  getPasskeyAuthenticationOptions: (...args: unknown[]) =>
    mockGetPasskeyAuthenticationOptions(...args),
  hasPasskeysForPending: (...args: unknown[]) => mockHasPasskeysForPending(...args),
}));

vi.mock("@simplewebauthn/browser", () => ({
  startAuthentication: vi.fn(),
}));

import { TwoFactorForm } from "@/app/login/two-factor/two-factor-form";

describe("TwoFactorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPasskeysForPending.mockResolvedValue(false);
  });

  it("renders TOTP input by default", () => {
    render(<TwoFactorForm pendingToken="test-token" />);
    expect(screen.getByTestId("totp-input")).toBeInTheDocument();
    expect(screen.getByTestId("totp-submit")).toBeInTheDocument();
  });

  it("submits TOTP code", async () => {
    mockVerifyTwoFactorLogin.mockResolvedValueOnce({
      success: false,
      message: "Invalid code. Please try again.",
    });

    render(<TwoFactorForm pendingToken="test-token" />);

    fireEvent.change(screen.getByTestId("totp-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("totp-submit"));

    await waitFor(() => {
      expect(mockVerifyTwoFactorLogin).toHaveBeenCalledWith("test-token", "123456");
      expect(screen.getByTestId("2fa-error")).toHaveTextContent("Invalid code");
    });
  });

  it("disables submit button when code is incomplete", () => {
    render(<TwoFactorForm pendingToken="test-token" />);

    const button = screen.getByTestId("totp-submit");
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByTestId("totp-input"), {
      target: { value: "123" },
    });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByTestId("totp-input"), {
      target: { value: "123456" },
    });
    expect(button).not.toBeDisabled();
  });

  it("strips non-numeric characters from TOTP input", () => {
    render(<TwoFactorForm pendingToken="test-token" />);
    const input = screen.getByTestId("totp-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12ab34cd56ef" } });
    expect(input.value).toBe("123456");
  });

  it("switches to backup code mode", async () => {
    render(<TwoFactorForm pendingToken="test-token" />);

    fireEvent.click(screen.getByTestId("switch-to-backup"));
    expect(screen.getByTestId("backup-code-input")).toBeInTheDocument();
    expect(screen.getByTestId("backup-code-submit")).toBeInTheDocument();
  });

  it("submits backup code", async () => {
    mockVerifyBackupCodeLogin.mockResolvedValueOnce({
      success: false,
      message: "Invalid backup code.",
    });

    render(<TwoFactorForm pendingToken="test-token" />);

    fireEvent.click(screen.getByTestId("switch-to-backup"));

    fireEvent.change(screen.getByTestId("backup-code-input"), {
      target: { value: "abcd-1234" },
    });
    fireEvent.click(screen.getByTestId("backup-code-submit"));

    await waitFor(() => {
      expect(mockVerifyBackupCodeLogin).toHaveBeenCalledWith("test-token", "abcd-1234");
    });
  });

  it("shows passkey option when user has passkeys", async () => {
    mockHasPasskeysForPending.mockResolvedValueOnce(true);

    render(<TwoFactorForm pendingToken="test-token" />);

    await waitFor(() => {
      expect(screen.getByTestId("switch-to-passkey")).toBeInTheDocument();
    });
  });

  it("hides passkey option when user has no passkeys", async () => {
    mockHasPasskeysForPending.mockResolvedValueOnce(false);

    render(<TwoFactorForm pendingToken="test-token" />);

    await waitFor(() => {
      expect(screen.queryByTestId("switch-to-passkey")).not.toBeInTheDocument();
    });
  });

  it("switches between modes correctly", async () => {
    mockHasPasskeysForPending.mockResolvedValueOnce(true);

    render(<TwoFactorForm pendingToken="test-token" />);

    // Start in TOTP mode
    expect(screen.getByTestId("totp-input")).toBeInTheDocument();

    // Switch to backup
    fireEvent.click(screen.getByTestId("switch-to-backup"));
    expect(screen.getByTestId("backup-code-input")).toBeInTheDocument();
    expect(screen.queryByTestId("totp-input")).not.toBeInTheDocument();

    // Switch back to TOTP
    fireEvent.click(screen.getByTestId("switch-to-totp"));
    expect(screen.getByTestId("totp-input")).toBeInTheDocument();
  });

  it("clears error when switching modes", async () => {
    mockVerifyTwoFactorLogin.mockResolvedValueOnce({
      success: false,
      message: "Invalid code.",
    });

    render(<TwoFactorForm pendingToken="test-token" />);

    // Submit bad TOTP code
    fireEvent.change(screen.getByTestId("totp-input"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByTestId("totp-submit"));

    await waitFor(() => {
      expect(screen.getByTestId("2fa-error")).toBeInTheDocument();
    });

    // Switch to backup mode — error should be cleared
    fireEvent.click(screen.getByTestId("switch-to-backup"));
    expect(screen.queryByTestId("2fa-error")).not.toBeInTheDocument();
  });

  it("has a back to login link", () => {
    render(<TwoFactorForm pendingToken="test-token" />);
    const link = screen.getByText("Back to login");
    expect(link).toHaveAttribute("href", "/login");
  });
});
