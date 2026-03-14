import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { NavLinks } from "@/components/nav-links";

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

describe("Search nav link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("renders a Search link in the nav", () => {
    render(<NavLinks username="testuser" />);
    const searchLink = screen.getByLabelText("Search");
    expect(searchLink).toBeInTheDocument();
    expect(searchLink.tagName).toBe("A");
  });

  it("links to /search", () => {
    render(<NavLinks username="testuser" />);
    expect(screen.getByLabelText("Search")).toHaveAttribute("href", "/search");
  });

  it("has teal active color when on /search", () => {
    vi.mocked(usePathname).mockReturnValue("/search");
    render(<NavLinks username="testuser" />);
    const searchLink = screen.getByLabelText("Search");
    expect(searchLink.className).toMatch(/(^| )text-teal-500( |$)/);
    expect(searchLink.className).toMatch(/(^| )bg-teal-50( |$)/);
  });

  it("has inactive color when not on /search", () => {
    vi.mocked(usePathname).mockReturnValue("/feed");
    render(<NavLinks username="testuser" />);
    const searchLink = screen.getByLabelText("Search");
    expect(searchLink.className).toContain("text-zinc-600");
  });

  it("contains a magnifying glass SVG icon", () => {
    render(<NavLinks username="testuser" />);
    const searchLink = screen.getByLabelText("Search");
    const svg = searchLink.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.classList.contains("h-5")).toBe(true);
    expect(svg?.classList.contains("w-5")).toBe(true);
  });
});
