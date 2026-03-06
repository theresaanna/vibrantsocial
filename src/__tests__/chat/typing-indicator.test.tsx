import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import type { ChatUserProfile } from "@/types/chat";

const makeUser = (id: string, name: string): ChatUserProfile => ({
  id,
  username: name.toLowerCase(),
  displayName: name,
  name,
  avatar: null,
  image: null,
});

const participants = new Map<string, ChatUserProfile>([
  ["alice-id", makeUser("alice-id", "Alice")],
  ["bob-id", makeUser("bob-id", "Bob")],
  ["charlie-id", makeUser("charlie-id", "Charlie")],
  ["me-id", makeUser("me-id", "Me")],
]);

describe("TypingIndicator", () => {
  it("returns null when nobody is typing", () => {
    const { container } = render(
      <TypingIndicator
        typingUserIds={new Set()}
        participants={participants}
        currentUserId="me-id"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when only current user is typing", () => {
    const { container } = render(
      <TypingIndicator
        typingUserIds={new Set(["me-id"])}
        participants={participants}
        currentUserId="me-id"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "Alice is typing" for one person', () => {
    render(
      <TypingIndicator
        typingUserIds={new Set(["alice-id"])}
        participants={participants}
        currentUserId="me-id"
      />
    );
    expect(screen.getByText("Alice is typing")).toBeInTheDocument();
  });

  it('shows "Alice and Bob are typing" for two people', () => {
    render(
      <TypingIndicator
        typingUserIds={new Set(["alice-id", "bob-id"])}
        participants={participants}
        currentUserId="me-id"
      />
    );
    expect(
      screen.getByText("Alice and Bob are typing")
    ).toBeInTheDocument();
  });

  it('shows "3 people are typing" for three or more', () => {
    render(
      <TypingIndicator
        typingUserIds={new Set(["alice-id", "bob-id", "charlie-id"])}
        participants={participants}
        currentUserId="me-id"
      />
    );
    expect(screen.getByText("3 people are typing")).toBeInTheDocument();
  });

  it("filters out the current user from typing set", () => {
    render(
      <TypingIndicator
        typingUserIds={new Set(["alice-id", "me-id"])}
        participants={participants}
        currentUserId="me-id"
      />
    );
    expect(screen.getByText("Alice is typing")).toBeInTheDocument();
  });

  it('shows "Someone is typing" for unknown user', () => {
    render(
      <TypingIndicator
        typingUserIds={new Set(["unknown-id"])}
        participants={participants}
        currentUserId="me-id"
      />
    );
    expect(screen.getByText("Someone is typing")).toBeInTheDocument();
  });
});
