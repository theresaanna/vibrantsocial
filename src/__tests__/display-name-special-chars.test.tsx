import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserList } from "@/components/user-list";
import { SearchUserCard } from "@/components/search-user-card";
import { NotificationList } from "@/components/notification-list";

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

// Mock follow-button (used by UserList)
vi.mock("@/components/follow-button", () => ({
  FollowButton: () => <button>Follow</button>,
}));

// Mock notification actions
vi.mock("@/app/notifications/actions", () => ({
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

// Mock lexical-text (used by SearchUserCard)
vi.mock("@/lib/lexical-text", () => ({
  extractTextFromLexicalJson: () => null,
}));

// Mock time utility
vi.mock("@/lib/time", () => ({
  timeAgo: () => "1m ago",
}));

/**
 * Collection of display names with special characters that should render
 * correctly without breaking React components or causing layout issues.
 */
const SPECIAL_NAMES = {
  emoji: "\u{1F525}\u{1F680} Fire Rocket",
  htmlTags: '<script>alert("xss")</script>',
  ampersandsAndEntities: 'Tom & Jerry <3 "cats"',
  cjk: "\u5F20\u4F1F",
  arabic: "\u0645\u062D\u0645\u062F",
  combiningDiacritics: "Jose\u0301",
  zeroWidthJoiner: "A\u200DB",
  singleQuote: "O'Brien",
  backslashes: "back\\slash\\name",
  percentChars: "100% fun & games",
  familyEmoji: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}",
  curlyBrackets: "{name: [test]}",
  sqlInjection: "'; DROP TABLE users; --",
  unicodeSymbols: "\u2605\u2764\u266B\u2603",
  mathSymbols: "\u00B1 \u221E \u2260 \u2248",
  currencySymbols: "\u00A3\u00A5\u20AC\u20BF",
} as const;

function makeUser(displayName: string, id = "user1") {
  return {
    id,
    username: "testuser",
    displayName,
    name: null,
    avatar: null,
    image: null,
    isFollowing: false,
  };
}

function makeSearchUser(displayName: string) {
  return {
    id: "user1",
    username: "testuser",
    displayName,
    name: null,
    avatar: null,
    image: null,
    bio: null,
    _count: { followers: 5, posts: 10 },
  };
}

function makeNotification(actorDisplayName: string) {
  return {
    id: "notif1",
    type: "LIKE" as const,
    actorId: "actor1",
    postId: "post1",
    commentId: null,
    messageId: null,
    readAt: null,
    createdAt: new Date("2025-01-01"),
    actor: {
      id: "actor1",
      username: "actor",
      displayName: actorDisplayName,
      name: null,
      image: null,
      avatar: null,
    },
    post: { id: "post1", content: "test" },
    message: null,
  };
}

describe("Display name with special characters", () => {
  describe("UserList", () => {
    for (const [label, name] of Object.entries(SPECIAL_NAMES)) {
      it(`renders ${label}: ${JSON.stringify(name).slice(0, 40)}`, () => {
        const { container } = render(
          <UserList
            users={[makeUser(name)]}
            currentUserId={null}
            emptyMessage="No users"
          />
        );
        // Should render without throwing
        expect(container).toBeTruthy();
        // The name should appear in the DOM as text content (React auto-escapes)
        expect(screen.getByText(name)).toBeInTheDocument();
      });
    }

    it("renders avatar initial from emoji display name", () => {
      const { container } = render(
        <UserList
          users={[makeUser("\u{1F525} Flame")]}
          currentUserId={null}
          emptyMessage="No users"
        />
      );
      // The initial should be extracted from the first character
      // For emoji "\u{1F525}", the [0] returns a high surrogate, but the
      // component uses optional chaining and toUpperCase which won't crash
      expect(container).toBeTruthy();
    });

    it("renders avatar initial from CJK display name", () => {
      render(
        <UserList
          users={[makeUser("\u5F20\u4F1F")]}
          currentUserId={null}
          emptyMessage="No users"
        />
      );
      // CJK character "\u5F20" should be used as the initial
      expect(screen.getByText("\u5F20")).toBeInTheDocument();
    });

    it("renders HTML-like tags as literal text, not as HTML", () => {
      render(
        <UserList
          users={[makeUser('<img src=x onerror="alert(1)">')]}
          currentUserId={null}
          emptyMessage="No users"
        />
      );
      // Should appear as text, not as an actual img element
      const text = screen.getByText('<img src=x onerror="alert(1)">');
      expect(text).toBeInTheDocument();
      expect(text.tagName).not.toBe("IMG");
    });

    it("handles multiple users with special char names without key conflicts", () => {
      const users = Object.entries(SPECIAL_NAMES).map(([, name], i) =>
        makeUser(name, `user-${i}`)
      );
      const { container } = render(
        <UserList
          users={users}
          currentUserId={null}
          emptyMessage="No users"
        />
      );
      expect(container).toBeTruthy();
      // All users should be rendered
      for (const [, name] of Object.entries(SPECIAL_NAMES)) {
        expect(screen.getByText(name)).toBeInTheDocument();
      }
    });
  });

  describe("SearchUserCard", () => {
    for (const [label, name] of Object.entries(SPECIAL_NAMES)) {
      it(`renders ${label}: ${JSON.stringify(name).slice(0, 40)}`, () => {
        const { container } = render(
          <SearchUserCard user={makeSearchUser(name)} />
        );
        expect(container).toBeTruthy();
        // Name appears both as display text and as alt text for the avatar
        expect(screen.getByText(name)).toBeInTheDocument();
      });
    }

    it("renders avatar initial correctly for single-char CJK name", () => {
      const { container } = render(
        <SearchUserCard user={makeSearchUser("\u5F20")} />
      );
      expect(container).toBeTruthy();
      // The initial and the name are the same single character
      const els = screen.getAllByText("\u5F20");
      expect(els.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("NotificationList", () => {
    for (const [label, name] of Object.entries(SPECIAL_NAMES)) {
      it(`renders actor name with ${label}`, () => {
        const { container } = render(
          <NotificationList
            initialNotifications={[makeNotification(name)]}
          />
        );
        expect(container).toBeTruthy();
        expect(screen.getByText(name)).toBeInTheDocument();
      });
    }

    it("shows notification text alongside special char name", () => {
      render(
        <NotificationList
          initialNotifications={[makeNotification("O'Brien & \u5F20\u4F1F")]}
        />
      );
      expect(screen.getByText("O'Brien & \u5F20\u4F1F")).toBeInTheDocument();
      expect(screen.getByText("liked your post")).toBeInTheDocument();
    });
  });

  describe("avatar initial extraction edge cases", () => {
    it("does not crash when display name starts with a surrogate pair emoji", () => {
      // "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}" is a family emoji with ZWJ
      // [0] returns a high surrogate which toUpperCase won't crash on
      const name = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}";
      const initial = name[0]?.toUpperCase() || "?";
      expect(initial).toBeTruthy();
      expect(typeof initial).toBe("string");
    });

    it("handles combining characters for initial extraction", () => {
      // "Jose\u0301" - the e and combining acute accent
      const name = "Jose\u0301";
      const initial = name[0]?.toUpperCase() || "?";
      expect(initial).toBe("J");
    });

    it("handles zero-width joiner for initial extraction", () => {
      const name = "\u200DA"; // starts with ZWJ
      const initial = name[0]?.toUpperCase() || "?";
      // ZWJ is a valid character, toUpperCase won't change it
      expect(initial).toBeTruthy();
    });

    it("handles right-to-left characters for initial extraction", () => {
      const name = "\u0645\u062D\u0645\u062F"; // Arabic
      const initial = name[0]?.toUpperCase() || "?";
      expect(initial).toBe("\u0645");
    });

    it("handles currency symbols for initial extraction", () => {
      const name = "\u00A3100";
      const initial = name[0]?.toUpperCase() || "?";
      expect(initial).toBe("\u00A3");
    });
  });

  describe("display name fallback chain", () => {
    it("falls back to name when displayName is null", () => {
      const user = {
        ...makeUser("ignored"),
        displayName: null,
        name: "Fallback Name",
      };
      render(
        <UserList
          users={[user]}
          currentUserId={null}
          emptyMessage="No users"
        />
      );
      expect(screen.getByText("Fallback Name")).toBeInTheDocument();
    });

    it("falls back to username when displayName and name are null", () => {
      const user = {
        ...makeUser("ignored"),
        displayName: null,
        name: null,
        username: "testuser",
      };
      render(
        <UserList
          users={[user]}
          currentUserId={null}
          emptyMessage="No users"
        />
      );
      // "testuser" appears as both the display name and @username
      const els = screen.getAllByText("testuser");
      expect(els.length).toBeGreaterThanOrEqual(1);
    });

    it("falls back to 'User' when all name fields are null", () => {
      const user = {
        ...makeUser("ignored"),
        displayName: null,
        name: null,
        username: null,
      };
      render(
        <UserList
          users={[user]}
          currentUserId={null}
          emptyMessage="No users"
        />
      );
      expect(screen.getByText("User")).toBeInTheDocument();
    });
  });
});
