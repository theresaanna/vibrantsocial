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

import { SearchUserCard } from "@/components/search-user-card";

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

const baseUser = {
  id: "user1",
  username: "alice",
  displayName: "Alice Smith",
  name: null,
  avatar: null,
  image: null,
  bio: makeLexicalContent("I love coding"),
  _count: { followers: 10, posts: 5 },
};

describe("SearchUserCard", () => {
  it("renders extracted plain text from Lexical JSON bio", () => {
    render(<SearchUserCard user={baseUser} />);
    expect(screen.getByText("I love coding")).toBeInTheDocument();
  });

  it("does not render raw Lexical JSON", () => {
    render(<SearchUserCard user={baseUser} />);
    expect(screen.queryByText(/root/)).not.toBeInTheDocument();
  });

  it("renders bio with mentions as @username", () => {
    const bio = JSON.stringify({
      root: {
        children: [
          {
            children: [
              { text: "Friends with ", type: "text", version: 1 },
              { type: "mention", username: "bob", version: 1 },
            ],
            type: "paragraph",
            version: 1,
          },
        ],
        type: "root",
        version: 1,
      },
    });
    const user = { ...baseUser, bio };
    render(<SearchUserCard user={user} />);
    expect(screen.getByText(/Friends with/)).toBeInTheDocument();
    expect(screen.getByText(/@bob/)).toBeInTheDocument();
  });

  it("renders empty for non-JSON bio string", () => {
    // extractTextFromLexicalJson returns "" for non-JSON input
    const user = { ...baseUser, bio: "Just a plain bio" };
    render(<SearchUserCard user={user} />);
    expect(screen.queryByText("Just a plain bio")).not.toBeInTheDocument();
  });

  it("renders display name and username", () => {
    render(<SearchUserCard user={baseUser} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
  });

  it("renders follower and post counts", () => {
    render(<SearchUserCard user={baseUser} />);
    expect(screen.getByText("10 followers")).toBeInTheDocument();
    expect(screen.getByText("5 posts")).toBeInTheDocument();
  });

  it("uses singular form for count of 1", () => {
    const user = { ...baseUser, _count: { followers: 1, posts: 1 } };
    render(<SearchUserCard user={user} />);
    expect(screen.getByText("1 follower")).toBeInTheDocument();
    expect(screen.getByText("1 post")).toBeInTheDocument();
  });

  it("links to user profile page", () => {
    render(<SearchUserCard user={baseUser} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/alice");
  });

  it("does not show bio section when bio is null", () => {
    const user = { ...baseUser, bio: null };
    render(<SearchUserCard user={user} />);
    expect(screen.queryByText("I love coding")).not.toBeInTheDocument();
  });
});
