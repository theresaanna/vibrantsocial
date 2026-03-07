import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

import { SearchPostCard } from "@/components/search-post-card";

function makeLexicalContent(text: string) {
  return JSON.stringify({
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text,
              type: "text",
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

function makeLexicalWithMention(text: string, username: string) {
  return JSON.stringify({
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text,
              type: "text",
              version: 1,
            },
            {
              type: "mention",
              username,
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

const basePost = {
  id: "post1",
  content: makeLexicalContent("Hello world, this is a test post"),
  createdAt: new Date().toISOString(),
  author: {
    id: "user1",
    username: "alice",
    displayName: "Alice Smith",
    name: null,
    avatar: null,
    image: null,
  },
  _count: {
    likes: 5,
    comments: 3,
    reposts: 1,
  },
};

describe("SearchPostCard", () => {
  it("renders extracted plain text from Lexical JSON", () => {
    render(<SearchPostCard post={basePost} />);
    expect(
      screen.getByText("Hello world, this is a test post")
    ).toBeInTheDocument();
  });

  it("renders mentions as @username in text", () => {
    const post = {
      ...basePost,
      content: makeLexicalWithMention("Hey ", "bob"),
    };
    render(<SearchPostCard post={post} />);
    expect(screen.getByText(/Hey/)).toBeInTheDocument();
    expect(screen.getByText(/@bob/)).toBeInTheDocument();
  });

  it("shows 'No content' for invalid JSON", () => {
    const post = { ...basePost, content: "not json" };
    render(<SearchPostCard post={post} />);
    expect(screen.getByText("No content")).toBeInTheDocument();
  });

  it("shows 'No content' for empty Lexical document", () => {
    const post = {
      ...basePost,
      content: JSON.stringify({
        root: { children: [], type: "root", version: 1 },
      }),
    };
    render(<SearchPostCard post={post} />);
    expect(screen.getByText("No content")).toBeInTheDocument();
  });

  it("renders multi-paragraph content as joined text", () => {
    const content = JSON.stringify({
      root: {
        children: [
          {
            children: [
              { text: "First paragraph", type: "text", version: 1 },
            ],
            type: "paragraph",
            version: 1,
          },
          {
            children: [
              { text: "Second paragraph", type: "text", version: 1 },
            ],
            type: "paragraph",
            version: 1,
          },
        ],
        type: "root",
        version: 1,
      },
    });
    const post = { ...basePost, content };
    render(<SearchPostCard post={post} />);
    expect(
      screen.getByText("First paragraph Second paragraph")
    ).toBeInTheDocument();
  });

  it("renders author display name", () => {
    render(<SearchPostCard post={basePost} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("renders author username with @ prefix", () => {
    render(<SearchPostCard post={basePost} />);
    expect(screen.getByText("@alice")).toBeInTheDocument();
  });

  it("renders like, comment, and repost counts", () => {
    render(<SearchPostCard post={basePost} />);
    expect(screen.getByText("5 likes")).toBeInTheDocument();
    expect(screen.getByText("3 comments")).toBeInTheDocument();
    expect(screen.getByText("1 repost")).toBeInTheDocument();
  });

  it("uses singular form for count of 1", () => {
    const post = {
      ...basePost,
      _count: { likes: 1, comments: 1, reposts: 1 },
    };
    render(<SearchPostCard post={post} />);
    expect(screen.getByText("1 like")).toBeInTheDocument();
    expect(screen.getByText("1 comment")).toBeInTheDocument();
    expect(screen.getByText("1 repost")).toBeInTheDocument();
  });

  it("links to the post page", () => {
    render(<SearchPostCard post={basePost} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/post/post1");
  });

  it("shows avatar image when available", () => {
    const post = {
      ...basePost,
      author: { ...basePost.author, avatar: "https://example.com/avatar.jpg" },
    };
    render(<SearchPostCard post={post} />);
    const img = screen.getByAltText("Alice Smith");
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("shows initial when no avatar", () => {
    render(<SearchPostCard post={basePost} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("falls back to username when no displayName or name", () => {
    const post = {
      ...basePost,
      author: {
        ...basePost.author,
        displayName: null,
        name: null,
        username: "alice",
      },
    };
    render(<SearchPostCard post={post} />);
    // "alice" appears both as the display name and as @alice
    const aliceElements = screen.getAllByText("alice");
    expect(aliceElements.length).toBeGreaterThanOrEqual(1);
  });
});
