import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmailVerificationBanner } from "@/components/email-verification-banner";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));
vi.mock("@/app/profile/actions", () => ({
  resendVerificationEmail: vi.fn(),
}));

import { useSession } from "next-auth/react";

const mockUseSession = vi.mocked(useSession);

describe("EmailVerificationBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when user is not logged in", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });

    const { container } = render(<EmailVerificationBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("does not render when email is already verified", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { emailVerified: true },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    } as never);

    const { container } = render(<EmailVerificationBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders banner when email is not verified", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { emailVerified: false },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    } as never);

    render(<EmailVerificationBanner />);
    expect(
      screen.getByText(/Please verify your email address/)
    ).toBeInTheDocument();
  });

  it("shows Resend button", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { emailVerified: false },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    } as never);

    render(<EmailVerificationBanner />);
    expect(screen.getByText("Resend")).toBeInTheDocument();
  });

  it("shows dismiss button", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { emailVerified: false },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    } as never);

    render(<EmailVerificationBanner />);
    expect(
      screen.getByRole("button", { name: "Dismiss" })
    ).toBeInTheDocument();
  });

  it("hides banner when dismiss is clicked", async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { emailVerified: false },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: vi.fn(),
    } as never);

    render(<EmailVerificationBanner />);
    expect(
      screen.getByText(/Please verify your email address/)
    ).toBeInTheDocument();

    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });
    await userEvent.click(dismissBtn);

    expect(
      screen.queryByText(/Please verify your email address/)
    ).not.toBeInTheDocument();
  });
});
