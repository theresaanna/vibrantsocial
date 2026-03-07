import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SeenByIndicator } from "@/components/chat/seen-by-indicator";
import type { ChatUserProfile } from "@/types/chat";

const makeUser = (
  id: string,
  name: string,
  avatar?: string
): ChatUserProfile => ({
  id,
  username: name.toLowerCase(),
  displayName: name,
  name,
  avatar: avatar ?? null,
  image: null,
});

describe("SeenByIndicator", () => {
  it("returns null when seenBy is empty", () => {
    const { container } = render(<SeenByIndicator seenBy={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders avatar for a single reader with avatar", () => {
    const users = [makeUser("u1", "Alice", "https://img/alice.jpg")];
    render(<SeenByIndicator seenBy={users} />);
    const img = screen.getByAltText("Alice");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://img/alice.jpg");
  });

  it("renders initial letter fallback when no avatar", () => {
    const users = [makeUser("u1", "Bob")];
    render(<SeenByIndicator seenBy={users} />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("renders multiple avatars up to 3", () => {
    const users = [
      makeUser("u1", "Alice"),
      makeUser("u2", "Bob"),
      makeUser("u3", "Charlie"),
    ];
    render(<SeenByIndicator seenBy={users} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("shows +N overflow when more than 3 readers", () => {
    const users = [
      makeUser("u1", "Alice"),
      makeUser("u2", "Bob"),
      makeUser("u3", "Charlie"),
      makeUser("u4", "Dana"),
      makeUser("u5", "Eve"),
    ];
    render(<SeenByIndicator seenBy={users} />);
    expect(screen.getByText("+2")).toBeInTheDocument();
    // Only first 3 avatars rendered
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("has accessible label listing all reader names", () => {
    const users = [makeUser("u1", "Alice"), makeUser("u2", "Bob")];
    render(<SeenByIndicator seenBy={users} />);
    expect(
      screen.getByLabelText("Seen by Alice, Bob")
    ).toBeInTheDocument();
  });

  it("shows popover with full names on click", () => {
    const users = [makeUser("u1", "Alice"), makeUser("u2", "Bob")];
    render(<SeenByIndicator seenBy={users} />);
    fireEvent.click(screen.getByLabelText("Seen by Alice, Bob"));
    expect(screen.getByText("Seen by")).toBeInTheDocument();
  });

  it("toggles popover off on second click", () => {
    const users = [makeUser("u1", "Alice")];
    render(<SeenByIndicator seenBy={users} />);
    const btn = screen.getByLabelText("Seen by Alice");
    fireEvent.click(btn);
    expect(screen.getByText("Seen by")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText("Seen by")).not.toBeInTheDocument();
  });

  it("falls back to 'User' for participants with no name fields", () => {
    const user: ChatUserProfile = {
      id: "u1",
      username: null,
      displayName: null,
      name: null,
      avatar: null,
      image: null,
    };
    render(<SeenByIndicator seenBy={[user]} />);
    expect(screen.getByLabelText("Seen by User")).toBeInTheDocument();
    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("uses image field as fallback when avatar is null", () => {
    const user: ChatUserProfile = {
      id: "u1",
      username: "alice",
      displayName: "Alice",
      name: "Alice",
      avatar: null,
      image: "https://img/alice-image.jpg",
    };
    render(<SeenByIndicator seenBy={[user]} />);
    const img = screen.getByAltText("Alice");
    expect(img).toHaveAttribute("src", "https://img/alice-image.jpg");
  });
});
