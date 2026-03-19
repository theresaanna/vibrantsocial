import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock the client components to avoid their internal imports
vi.mock("@/app/premium/subscribe-button", () => ({
  SubscribeButton: () => <button>Subscribe to Premium</button>,
}));

vi.mock("@/app/premium/manage-button", () => ({
  ManageButton: () => <button>Manage Subscription</button>,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { auth } from "@/auth";
import PremiumPage from "@/app/premium/page";

const mockAuth = vi.mocked(auth);

describe("PremiumPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows subscribe button when user is logged in and not premium", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", tier: "free" },
    } as never);

    const page = await PremiumPage();
    render(page);

    expect(screen.getByText("Subscribe to Premium")).toBeInTheDocument();
    expect(screen.queryByText("Manage Subscription")).not.toBeInTheDocument();
    expect(screen.queryByText("Log in to subscribe")).not.toBeInTheDocument();
  });

  it("shows manage button when user is logged in and premium", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", tier: "premium" },
    } as never);

    const page = await PremiumPage();
    render(page);

    expect(screen.getByText("Manage Subscription")).toBeInTheDocument();
    expect(screen.getByText("✓ Premium Member")).toBeInTheDocument();
    expect(screen.queryByText("Subscribe to Premium")).not.toBeInTheDocument();
  });

  it("shows login link when user is not logged in", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const page = await PremiumPage();
    render(page);

    expect(screen.getByText("Log in to subscribe")).toBeInTheDocument();
    expect(screen.queryByText("Subscribe to Premium")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage Subscription")).not.toBeInTheDocument();
  });

  it("displays all premium features", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const page = await PremiumPage();
    render(page);

    expect(screen.getByText("Custom Profile Themes")).toBeInTheDocument();
    expect(screen.getByText("Profile Picture Frames")).toBeInTheDocument();
    expect(screen.getByText("Custom Backgrounds")).toBeInTheDocument();
    expect(screen.getByText("Custom Audience")).toBeInTheDocument();
    expect(screen.getByText("And More")).toBeInTheDocument();
  });

  it("displays Premium heading", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const page = await PremiumPage();
    render(page);

    expect(screen.getByText("Premium")).toBeInTheDocument();
  });

  it("does not show Coming Soon button anymore", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-1", tier: "free" },
    } as never);

    const page = await PremiumPage();
    render(page);

    expect(screen.queryByText(/Coming Soon/)).not.toBeInTheDocument();
  });

  it("login link points to /login", async () => {
    mockAuth.mockResolvedValueOnce(null as never);

    const page = await PremiumPage();
    render(page);

    const link = screen.getByText("Log in to subscribe");
    expect(link).toHaveAttribute("href", "/login");
  });
});
