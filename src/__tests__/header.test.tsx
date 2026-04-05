import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Header is now a synchronous component (no async data fetching).
// The async data-fetching logic lives in HeaderAuth, tested separately.
import { Header } from "@/components/header";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
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

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Toggle</div>,
}));

// HeaderAuth is async and wrapped in Suspense — mock it for Header tests
vi.mock("@/components/header-auth", () => ({
  HeaderAuth: () => <div data-testid="header-auth">Auth Content</div>,
}));

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders logo link immediately (not blocked by data fetching)", () => {
    render(<Header />);

    const logo = screen.getByAltText("VibrantSocial");
    expect(logo.closest("a")).toHaveAttribute("href", "/");
  });

  it("renders theme toggle immediately", () => {
    render(<Header />);

    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("renders header-auth content via Suspense", () => {
    render(<Header />);

    expect(screen.getByTestId("header-auth")).toBeInTheDocument();
  });

  it("is a synchronous component (not async)", () => {
    // Header should NOT be async — it must return JSX immediately
    // so the page shell can stream before DB queries complete.
    const result = Header();
    // If Header were async, result would be a Promise
    expect(result).not.toBeInstanceOf(Promise);
  });
});
