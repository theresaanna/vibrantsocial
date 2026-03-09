import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddEmailBanner } from "@/components/add-email-banner";

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

const STORAGE_KEY = "vibrantsocial-add-email-dismissed";

describe("AddEmailBanner", () => {
  let originalLocalStorage: Storage;

  beforeEach(() => {
    originalLocalStorage = window.localStorage;
    // Clear localStorage
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("does not render when hasEmail is true", () => {
    const { container } = render(<AddEmailBanner hasEmail={true} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when hasEmail is false and not dismissed", () => {
    render(<AddEmailBanner hasEmail={false} />);
    expect(
      screen.getByText("Add an email to your account")
    ).toBeInTheDocument();
  });

  it("does not render when localStorage has dismissal key set", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    const { container } = render(<AddEmailBanner hasEmail={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("sets localStorage key on dismiss click", async () => {
    render(<AddEmailBanner hasEmail={false} />);
    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });
    await userEvent.click(dismissBtn);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("hides after dismiss click", async () => {
    render(<AddEmailBanner hasEmail={false} />);
    expect(
      screen.getByText("Add an email to your account")
    ).toBeInTheDocument();

    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });
    await userEvent.click(dismissBtn);

    expect(
      screen.queryByText("Add an email to your account")
    ).not.toBeInTheDocument();
  });

  it("contains link to /profile", () => {
    render(<AddEmailBanner hasEmail={false} />);
    const link = screen.getByRole("link", { name: "Add email" });
    expect(link).toHaveAttribute("href", "/profile");
  });

  it("contains expected descriptive text", () => {
    render(<AddEmailBanner hasEmail={false} />);
    expect(
      screen.getByText(/Get notifications and recover your account/)
    ).toBeInTheDocument();
  });

  it("handles localStorage errors gracefully on read", () => {
    // Simulate localStorage throwing (e.g., private browsing)
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("localStorage disabled");
      });

    const { container } = render(<AddEmailBanner hasEmail={false} />);
    // Should not render (error is caught, returns early)
    expect(container.innerHTML).toBe("");

    getItemSpy.mockRestore();
  });

  it("handles localStorage errors gracefully on dismiss", async () => {
    render(<AddEmailBanner hasEmail={false} />);

    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("localStorage disabled");
      });

    const dismissBtn = screen.getByRole("button", { name: "Dismiss" });
    await userEvent.click(dismissBtn);

    // Should still hide even if localStorage fails
    expect(
      screen.queryByText("Add an email to your account")
    ).not.toBeInTheDocument();

    setItemSpy.mockRestore();
  });

  it("is visible on all screen sizes (no md:hidden class)", () => {
    render(<AddEmailBanner hasEmail={false} />);
    const banner = screen
      .getByText("Add an email to your account")
      .closest("div.mb-4");
    expect(banner).not.toBeNull();
    // The AddToHomeBanner has md:hidden, this one should NOT
    expect(banner?.className).not.toContain("md:hidden");
  });
});
