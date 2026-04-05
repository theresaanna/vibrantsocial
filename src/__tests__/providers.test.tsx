import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/dynamic to bypass ssr:false (which returns null in jsdom)
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    // Eagerly resolve the module for testing
    const MockComponent = ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="ably-provider">{children}</div>
    );
    MockComponent.displayName = "DynamicAblyProvider";
    return MockComponent;
  },
}));

// Mock next-auth session provider
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
  useSession: () => ({ data: null }),
}));

// Mock next-themes
vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
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

  it("provides useAblyReady with initial value of false", () => {
    render(
      <Providers>
        <AblyReadyIndicator />
      </Providers>
    );

    expect(screen.getByTestId("ably-ready").textContent).toBe("false");
  });
});
