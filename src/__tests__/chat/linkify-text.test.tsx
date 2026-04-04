import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkifyText, extractFirstUrlFromText } from "@/components/chat/linkify-text";

describe("LinkifyText", () => {
  it("renders plain text without links", () => {
    render(<LinkifyText text="hello world" />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  // --- URL linking (existing behavior) ---

  it("linkifies URLs", () => {
    render(<LinkifyText text="visit https://example.com today" />);
    const link = screen.getByRole("link", { name: "https://example.com" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("linkifies email addresses", () => {
    render(<LinkifyText text="email me at test@example.com" />);
    const link = screen.getByRole("link", { name: "test@example.com" });
    expect(link).toHaveAttribute("href", "mailto:test@example.com");
  });

  // --- Bare domain linking ---

  it("linkifies bare domains like example.com", () => {
    render(<LinkifyText text="visit example.com today" />);
    const link = screen.getByRole("link", { name: "example.com" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("linkifies bare domains with paths", () => {
    render(<LinkifyText text="go to example.com/about" />);
    const link = screen.getByRole("link", { name: "example.com/about" });
    expect(link).toHaveAttribute("href", "https://example.com/about");
  });

  it("linkifies subdomains like docs.google.com", () => {
    render(<LinkifyText text="see docs.google.com" />);
    const link = screen.getByRole("link", { name: "docs.google.com" });
    expect(link).toHaveAttribute("href", "https://docs.google.com");
  });

  it("linkifies .io domains", () => {
    render(<LinkifyText text="check github.io" />);
    const link = screen.getByRole("link", { name: "github.io" });
    expect(link).toHaveAttribute("href", "https://github.io");
  });

  it("does not linkify words with dots but invalid TLD", () => {
    render(<LinkifyText text="hello.there friend" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("prefers email match over bare domain for user@example.com", () => {
    render(<LinkifyText text="email user@example.com" />);
    const link = screen.getByRole("link", { name: "user@example.com" });
    expect(link).toHaveAttribute("href", "mailto:user@example.com");
  });

  // --- Hashtag linking ---

  it("links #tag to /tag/tag", () => {
    render(<LinkifyText text="check out #react" />);
    const link = screen.getByRole("link", { name: "#react" });
    expect(link).toHaveAttribute("href", "/tag/react");
  });

  it("links hashtag at start of text", () => {
    render(<LinkifyText text="#javascript is great" />);
    const link = screen.getByRole("link", { name: "#javascript" });
    expect(link).toHaveAttribute("href", "/tag/javascript");
  });

  it("normalizes hashtag to lowercase in href", () => {
    render(<LinkifyText text="check #React" />);
    const link = screen.getByRole("link", { name: "#React" });
    expect(link).toHaveAttribute("href", "/tag/react");
  });

  it("supports hashtags with hyphens", () => {
    render(<LinkifyText text="see #web-dev" />);
    const link = screen.getByRole("link", { name: "#web-dev" });
    expect(link).toHaveAttribute("href", "/tag/web-dev");
  });

  it("does not link # alone", () => {
    render(<LinkifyText text="use # for comments" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not link hashtag inside a URL", () => {
    render(<LinkifyText text="go to https://example.com/page#section" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://example.com/page#section");
  });

  it("does not match hashtag preceded by alphanumeric", () => {
    render(<LinkifyText text="issue#123 is fixed" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links multiple hashtags", () => {
    render(<LinkifyText text="#react #nextjs #typescript" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/tag/react");
    expect(links[1]).toHaveAttribute("href", "/tag/nextjs");
    expect(links[2]).toHaveAttribute("href", "/tag/typescript");
  });

  // --- @mention linking ---

  it("links @username to /username", () => {
    render(<LinkifyText text="hey @alice check this" />);
    const link = screen.getByRole("link", { name: "@alice" });
    expect(link).toHaveAttribute("href", "/alice");
  });

  it("links mention at start of text", () => {
    render(<LinkifyText text="@bob what do you think" />);
    const link = screen.getByRole("link", { name: "@bob" });
    expect(link).toHaveAttribute("href", "/bob");
  });

  it("does not link @ alone", () => {
    render(<LinkifyText text="send @ someone" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not link @ab (username too short)", () => {
    render(<LinkifyText text="hey @ab check this" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links mentions with underscores and numbers", () => {
    render(<LinkifyText text="follow @user_123" />);
    const link = screen.getByRole("link", { name: "@user_123" });
    expect(link).toHaveAttribute("href", "/user_123");
  });

  it("does not link mention preceded by alphanumeric (email-like)", () => {
    render(<LinkifyText text="email user@domain" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links email address, not as mention", () => {
    render(<LinkifyText text="email user@domain.com" />);
    const link = screen.getByRole("link", { name: "user@domain.com" });
    expect(link).toHaveAttribute("href", "mailto:user@domain.com");
  });

  it("links multiple mentions", () => {
    render(<LinkifyText text="@alice and @bob123" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/alice");
    expect(links[1]).toHaveAttribute("href", "/bob123");
  });

  // --- Mixed content ---

  it("handles text with URLs, hashtags, and mentions together", () => {
    render(
      <LinkifyText text="@alice check https://example.com for #react tips" />
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/alice");
    expect(links[1]).toHaveAttribute("href", "https://example.com");
    expect(links[2]).toHaveAttribute("href", "/tag/react");
  });

  // --- Styling ---

  it("applies font-medium to hashtag links (no break-all)", () => {
    render(<LinkifyText text="#react" />);
    const link = screen.getByRole("link", { name: "#react" });
    expect(link.className).toContain("font-medium");
    expect(link.className).not.toContain("break-all");
  });

  it("applies font-medium to mention links (no break-all)", () => {
    render(<LinkifyText text="@alice" />);
    const link = screen.getByRole("link", { name: "@alice" });
    expect(link.className).toContain("font-medium");
    expect(link.className).not.toContain("break-all");
  });

  it("applies underline break-all to URL links", () => {
    render(<LinkifyText text="https://example.com" />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("underline");
    expect(link.className).toContain("break-all");
  });

  it("does not set target=_blank on hashtag or mention links", () => {
    render(<LinkifyText text="#react @alice" />);
    const links = screen.getAllByRole("link");
    for (const link of links) {
      expect(link).not.toHaveAttribute("target");
    }
  });
});

describe("extractFirstUrlFromText", () => {
  it("extracts https URL", () => {
    expect(extractFirstUrlFromText("check https://example.com today")).toBe("https://example.com");
  });

  it("extracts http URL", () => {
    expect(extractFirstUrlFromText("visit http://example.com/page")).toBe("http://example.com/page");
  });

  it("extracts URL with path and query", () => {
    expect(extractFirstUrlFromText("see https://example.com/path?q=1&b=2")).toBe(
      "https://example.com/path?q=1&b=2"
    );
  });

  it("extracts www domain and normalizes to https", () => {
    expect(extractFirstUrlFromText("go to www.example.com")).toBe("https://www.example.com");
  });

  it("extracts bare domain and normalizes to https", () => {
    expect(extractFirstUrlFromText("visit example.com")).toBe("https://example.com");
  });

  it("extracts bare domain with path", () => {
    expect(extractFirstUrlFromText("see example.com/about")).toBe("https://example.com/about");
  });

  it("returns first URL when multiple present", () => {
    expect(
      extractFirstUrlFromText("first https://a.com then https://b.com")
    ).toBe("https://a.com");
  });

  it("returns null for text without URLs", () => {
    expect(extractFirstUrlFromText("just plain text")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractFirstUrlFromText("")).toBeNull();
  });

  it("does not match email addresses", () => {
    expect(extractFirstUrlFromText("email me at user@example.com")).toBeNull();
  });

  it("extracts URL from text with mentions and hashtags", () => {
    expect(
      extractFirstUrlFromText("@alice check https://example.com #react")
    ).toBe("https://example.com");
  });

  it("extracts .io domain", () => {
    expect(extractFirstUrlFromText("check github.io")).toBe("https://github.io");
  });

  it("extracts subdomain", () => {
    expect(extractFirstUrlFromText("see docs.google.com")).toBe("https://docs.google.com");
  });

  it("does not match words with invalid TLD", () => {
    expect(extractFirstUrlFromText("hello.there friend")).toBeNull();
  });
});
