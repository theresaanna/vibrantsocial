import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockRequestPasswordChangeEmail = vi.fn();

vi.mock("@/app/profile/actions", () => ({
  requestPasswordChangeEmail: () => mockRequestPasswordChangeEmail(),
}));

import { PasswordSection } from "@/app/profile/password-section";

describe("PasswordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nothing for non-credentials users", () => {
    const { container } = render(
      <PasswordSection isCredentialsUser={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the section for credentials users", () => {
    render(<PasswordSection isCredentialsUser={true} />);
    expect(screen.getByText("Change Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });

  it("shows descriptive text about the email flow", () => {
    render(<PasswordSection isCredentialsUser={true} />);
    expect(screen.getByText(/password reset link to your email/i)).toBeInTheDocument();
  });

  it("shows success message after sending email", async () => {
    mockRequestPasswordChangeEmail.mockResolvedValueOnce({
      success: true,
      message: "Password reset link sent! Check your inbox.",
    });

    render(<PasswordSection isCredentialsUser={true} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId("change-password-submit"));
    });

    expect(screen.getByTestId("change-password-message")).toHaveTextContent(
      "Password reset link sent! Check your inbox."
    );
    expect(screen.getByTestId("change-password-message")).toHaveClass("text-green-600");
  });

  it("shows error message on failure", async () => {
    mockRequestPasswordChangeEmail.mockResolvedValueOnce({
      success: false,
      message: "Your account uses social login. Password cannot be changed here.",
    });

    render(<PasswordSection isCredentialsUser={true} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId("change-password-submit"));
    });

    expect(screen.getByTestId("change-password-message")).toHaveTextContent(
      "social login"
    );
    expect(screen.getByTestId("change-password-message")).toHaveClass("text-red-600");
  });

  it("calls requestPasswordChangeEmail on click", async () => {
    mockRequestPasswordChangeEmail.mockResolvedValueOnce({
      success: true,
      message: "Sent!",
    });

    render(<PasswordSection isCredentialsUser={true} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId("change-password-submit"));
    });

    expect(mockRequestPasswordChangeEmail).toHaveBeenCalledTimes(1);
  });
});
