import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn().mockReturnValue({
    data: { user: { id: "user1" }, expires: "2026-12-31" },
    status: "authenticated",
    update: vi.fn(),
  }),
  signIn: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/app/profile/account-linking-actions", () => ({
  linkAccount: vi.fn(),
  startOAuthLink: vi.fn(),
}));

import { signIn } from "next-auth/react";
import { startOAuthLink } from "@/app/profile/account-linking-actions";
import { LinkAccountModal } from "@/components/link-account-modal";

const mockStartOAuthLink = vi.mocked(startOAuthLink);
const mockSignIn = vi.mocked(signIn);

describe("LinkAccountModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when not open", () => {
    const { container } = render(
      <LinkAccountModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the modal when open", () => {
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("link-account-modal")).toBeInTheDocument();
    expect(screen.getByText("Link another account")).toBeInTheDocument();
  });

  it("renders email and password inputs", () => {
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("link-email-input")).toBeInTheDocument();
    expect(screen.getByTestId("link-password-input")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("link-account-submit")).toBeInTheDocument();
    expect(screen.getByTestId("link-account-submit")).toHaveTextContent("Link account");
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<LinkAccountModal isOpen={true} onClose={onClose} />);

    const closeButton = screen.getByLabelText("Close");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<LinkAccountModal isOpen={true} onClose={onClose} />);

    const backdrop = screen.getByTestId("link-account-modal");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when modal content is clicked", () => {
    const onClose = vi.fn();
    render(<LinkAccountModal isOpen={true} onClose={onClose} />);

    // Click on the form title (inside the modal content)
    fireEvent.click(screen.getByText("Link another account"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<LinkAccountModal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("has proper email input attributes", () => {
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);
    const emailInput = screen.getByTestId("link-email-input");
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("required");
    expect(emailInput).toHaveAttribute("name", "email");
  });

  it("has proper password input attributes", () => {
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);
    const passwordInput = screen.getByTestId("link-password-input");
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveAttribute("required");
    expect(passwordInput).toHaveAttribute("name", "password");
  });

  it("renders Google OAuth button", () => {
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);
    const googleButton = screen.getByTestId("link-google-button");
    expect(googleButton).toBeInTheDocument();
    expect(googleButton).toHaveTextContent("Link with Google");
  });

  it("renders Discord OAuth button", () => {
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);
    const discordButton = screen.getByTestId("link-discord-button");
    expect(discordButton).toBeInTheDocument();
    expect(discordButton).toHaveTextContent("Link with Discord");
  });

  it("renders credentials divider", () => {
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("or sign in with credentials")).toBeInTheDocument();
  });

  it("calls startOAuthLink and signIn when Google button is clicked", async () => {
    mockStartOAuthLink.mockResolvedValue({ success: true, message: "Ready to link" });
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);

    const googleButton = screen.getByTestId("link-google-button");
    fireEvent.click(googleButton);

    // Wait for async operations
    await vi.waitFor(() => {
      expect(mockStartOAuthLink).toHaveBeenCalledWith("google");
    });
    expect(mockSignIn).toHaveBeenCalledWith("google", { callbackUrl: "/profile" });
  });

  it("calls startOAuthLink and signIn when Discord button is clicked", async () => {
    mockStartOAuthLink.mockResolvedValue({ success: true, message: "Ready to link" });
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);

    const discordButton = screen.getByTestId("link-discord-button");
    fireEvent.click(discordButton);

    await vi.waitFor(() => {
      expect(mockStartOAuthLink).toHaveBeenCalledWith("discord");
    });
    expect(mockSignIn).toHaveBeenCalledWith("discord", { callbackUrl: "/profile" });
  });

  it("does not call signIn when startOAuthLink fails", async () => {
    mockStartOAuthLink.mockResolvedValue({ success: false, message: "Not authenticated" });
    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);

    const googleButton = screen.getByTestId("link-google-button");
    fireEvent.click(googleButton);

    await vi.waitFor(() => {
      expect(mockStartOAuthLink).toHaveBeenCalledWith("google");
    });
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("disables OAuth buttons while loading", async () => {
    // Create a promise that we can control
    let resolveOAuth: (value: { success: boolean; message: string }) => void;
    const pendingPromise = new Promise<{ success: boolean; message: string }>((resolve) => {
      resolveOAuth = resolve;
    });
    mockStartOAuthLink.mockReturnValue(pendingPromise);

    render(<LinkAccountModal isOpen={true} onClose={vi.fn()} />);

    const googleButton = screen.getByTestId("link-google-button");
    const discordButton = screen.getByTestId("link-discord-button");

    fireEvent.click(googleButton);

    // Both buttons should be disabled while loading
    await vi.waitFor(() => {
      expect(googleButton).toBeDisabled();
    });
    expect(discordButton).toBeDisabled();
    expect(googleButton).toHaveTextContent("Redirecting...");

    // Resolve the promise
    resolveOAuth!({ success: true, message: "Ready to link" });
  });
});
