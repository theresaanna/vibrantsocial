import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock auth to return no session
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  signIn: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock next/link
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

// Mock the SignupForm client component
vi.mock("@/app/signup/signup-form", () => ({
  SignupForm: () => <div data-testid="signup-form">signup form</div>,
}));

import SignupPage from "@/app/signup/page";

describe("SignupPage OAuth buttons", () => {
  it("renders the Google sign-in button", async () => {
    const page = await SignupPage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(
      screen.getByRole("button", { name: /continue with google/i })
    ).toBeInTheDocument();
  });

  it("renders the Discord sign-in button", async () => {
    const page = await SignupPage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(
      screen.getByRole("button", { name: /continue with discord/i })
    ).toBeInTheDocument();
  });

  it("renders the 'or continue with' divider", async () => {
    const page = await SignupPage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByText("or continue with")).toBeInTheDocument();
  });

  it("renders the sign-in link for existing users", async () => {
    const page = await SignupPage({ searchParams: Promise.resolve({}) });
    render(page);
    const signInLink = screen.getByRole("link", { name: /sign in/i });
    expect(signInLink).toHaveAttribute("href", "/login");
  });
});
