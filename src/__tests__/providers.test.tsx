import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next-auth session provider
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

// Mock sonner
vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
  toast: vi.fn(),
}));

// Mock cookie toast
vi.mock("@/components/cookie-toast", () => ({
  CookieToast: () => null,
}));

// Mock comment count provider
vi.mock("@/hooks/use-comment-counts", () => ({
  CommentCountProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { Providers, useAblyReady } from "@/app/providers";

function AblyReadyIndicator() {
  const ready = useAblyReady();
  return <div data-testid="ably-ready">{String(ready)}</div>;
}

describe("Providers", () => {
  it("renders children within the provider tree", () => {
    render(
      <Providers>
        <div data-testid="child">Hello</div>
      </Providers>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("wraps children in SessionProvider and ThemeProvider", () => {
    render(
      <Providers>
        <div>content</div>
      </Providers>
    );

    expect(screen.getByTestId("session-provider")).toBeInTheDocument();
    expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
  });

  it("provides useAblyReady with initial value of false (before session loads)", () => {
    render(
      <Providers>
        <AblyReadyIndicator />
      </Providers>
    );

    expect(screen.getByTestId("ably-ready").textContent).toBe("false");
  });

  it("renders children immediately for logged-out visitors (no Ably loading delay)", () => {
    render(
      <Providers>
        <div data-testid="content">Feed content</div>
      </Providers>
    );

    // Children should be in the DOM immediately, not hidden behind a loading state
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByText("Feed content")).toBeInTheDocument();
  });
});
