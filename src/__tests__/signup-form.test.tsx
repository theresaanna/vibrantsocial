import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupForm } from "@/app/signup/signup-form";

// Mock the server action
vi.mock("@/app/signup/actions", () => ({
  signup: vi.fn(),
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

describe("SignupForm TOS checkbox", () => {
  it("renders the TOS agreement checkbox", () => {
    render(<SignupForm />);
    const checkbox = screen.getByRole("checkbox", { name: /i agree to the/i });
    expect(checkbox).toBeInTheDocument();
  });

  it("renders a link to the Terms of Service", () => {
    render(<SignupForm />);
    const tosLink = screen.getByRole("link", { name: /terms of service/i });
    expect(tosLink).toHaveAttribute("href", "/tos");
    expect(tosLink).toHaveAttribute("target", "_blank");
  });

  it("renders a link to the Privacy Policy", () => {
    render(<SignupForm />);
    const privacyLink = screen.getByRole("link", { name: /privacy policy/i });
    expect(privacyLink).toHaveAttribute("href", "/privacy");
    expect(privacyLink).toHaveAttribute("target", "_blank");
  });

  it("checkbox is unchecked by default", () => {
    render(<SignupForm />);
    const checkbox = screen.getByRole("checkbox", { name: /i agree to the/i });
    expect(checkbox).not.toBeChecked();
  });

  it("checkbox can be toggled", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    const checkbox = screen.getByRole("checkbox", { name: /i agree to the/i });

    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("checkbox has the required attribute", () => {
    render(<SignupForm />);
    const checkbox = screen.getByRole("checkbox", { name: /i agree to the/i });
    expect(checkbox).toBeRequired();
  });
});
