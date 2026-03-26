/**
 * Regression tests ensuring every component that displays a user's
 * name or avatar correctly applies StyledName (custom font) and
 * FramedAvatar (profile frame).
 *
 * These tests render each component with a user that has a custom font
 * and frame, then assert the styling is applied.  If a future change
 * accidentally drops a StyledName wrapper or swaps FramedAvatar for a
 * raw <img>, these tests will catch it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------- shared mocks ----------

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

vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: vi.fn().mockReturnValue("/"),
}));

vi.mock("@/lib/profile-fonts", () => ({
  getFontById: (id: string | null | undefined) => {
    if (id === "sofadi-one")
      return { id: "sofadi-one", name: "Sofadi One", googleFamily: "Sofadi+One", tier: "free" };
    return null;
  },
  getGoogleFontUrl: () => "https://fonts.googleapis.com/css2?family=Sofadi+One",
  isValidFontId: (id: string) => id === "sofadi-one",
}));

vi.mock("@/lib/profile-frames", () => ({
  getFrameById: (id: string | null | undefined) => {
    if (id === "spring-1")
      return { id: "spring-1", name: "Spring Bloom", src: "/frames/spring-1.svg", category: "spring" };
    return null;
  },
  isValidFrameId: (id: string) => id === "spring-1",
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "5m ago",
}));

// ---------- test user data ----------

const TEST_USER = {
  id: "user-1",
  username: "alice",
  displayName: "Alice Wonder",
  name: "Alice",
  avatar: "https://example.com/alice.jpg",
  image: null,
  profileFrameId: "spring-1",
  usernameFont: "sofadi-one",
};

/**
 * Asserts that a rendered name element has a Sofadi One font-family
 * applied via StyledName's inline style.
 */
function expectStyledFont(element: HTMLElement) {
  // StyledName wraps in a <span> with fontFamily
  const span = (element.closest("span[style]") || element.querySelector("span[style]") || element) as HTMLElement;
  expect(span.style.fontFamily).toContain("Sofadi One");
}

/**
 * Asserts that a container includes a FramedAvatar frame overlay
 * (an img with aria-hidden="true" pointing to a frame SVG).
 */
function expectFrameOverlay(container: HTMLElement) {
  const frameImg = container.querySelector('img[aria-hidden="true"]');
  expect(frameImg).toBeInTheDocument();
  expect(frameImg).toHaveAttribute("src", "/frames/spring-1.svg");
}

// =====================================================================
// 1. CloseFriendsClient
// =====================================================================
describe("CloseFriendsClient — font & frame consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Need to mock useActionState for CloseFriendsClient
  vi.mock("@/app/feed/close-friends-actions", () => ({
    addCloseFriend: vi.fn(),
    removeCloseFriend: vi.fn(),
  }));

  // Mock useActionState to avoid jsdom form issues
  vi.mock("react", async () => {
    const actual = await vi.importActual("react");
    return {
      ...actual,
      useActionState: (
        _action: unknown,
        initialState: unknown
      ) => {
        const [, setTriggered] = (actual as typeof import("react")).useState(false);
        const formAction = () => setTriggered(true);
        return [initialState, formAction, false];
      },
    };
  });

  it("applies StyledName to close friend display names", async () => {
    const { CloseFriendsClient } = await import(
      "@/app/close-friends/close-friends-client"
    );

    const closeFriends = [
      {
        id: "cf-1",
        friendId: TEST_USER.id,
        friend: { ...TEST_USER },
      },
    ];

    const { container } = render(
      <CloseFriendsClient closeFriends={closeFriends} availableFriends={[]} />
    );

    const nameEl = screen.getByText("Alice Wonder");
    expectStyledFont(nameEl);
    expectFrameOverlay(container);
  });

  it("applies StyledName to available friend display names", async () => {
    const { CloseFriendsClient } = await import(
      "@/app/close-friends/close-friends-client"
    );

    const { container } = render(
      <CloseFriendsClient closeFriends={[]} availableFriends={[{ ...TEST_USER }]} />
    );

    const nameEl = screen.getByText("Alice Wonder");
    expectStyledFont(nameEl);
    expectFrameOverlay(container);
  });
});

// =====================================================================
// 2. MediaGrid
// =====================================================================
describe("MediaGrid — font & frame consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock IntersectionObserver
    vi.stubGlobal(
      "IntersectionObserver",
      vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: vi.fn(),
      }))
    );
  });

  vi.mock("@/app/feed/media-actions", () => ({
    fetchMediaFeedPage: vi.fn(),
  }));

  function makeLexicalJson(children: unknown[]) {
    return JSON.stringify({
      root: {
        children,
        direction: null,
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    });
  }

  it("applies StyledName to media post author names", async () => {
    const { MediaGrid } = await import("@/components/media-grid");

    const post = {
      id: "post-1",
      slug: "test-post",
      content: makeLexicalJson([
        {
          type: "paragraph",
          children: [
            {
              type: "image",
              src: "https://example.com/photo.jpg",
              altText: "Test image",
              width: 800,
              height: 600,
              version: 1,
            },
          ],
        },
      ]),
      createdAt: "2026-03-20T10:00:00Z",
      author: {
        id: TEST_USER.id,
        username: TEST_USER.username,
        displayName: TEST_USER.displayName,
        name: TEST_USER.name,
        image: null,
        avatar: TEST_USER.avatar,
        profileFrameId: TEST_USER.profileFrameId,
        usernameFont: TEST_USER.usernameFont,
      },
    };

    render(<MediaGrid initialPosts={[post]} initialHasMore={false} />);

    // Author name is in the hover overlay
    const nameEl = screen.getByText("Alice Wonder");
    expectStyledFont(nameEl);
  });

  it("renders FramedAvatar component for media post author", async () => {
    const { MediaGrid } = await import("@/components/media-grid");

    const post = {
      id: "post-1",
      slug: "test-post",
      content: makeLexicalJson([
        {
          type: "paragraph",
          children: [
            {
              type: "image",
              src: "https://example.com/photo.jpg",
              altText: "Test image",
              width: 800,
              height: 600,
              version: 1,
            },
          ],
        },
      ]),
      createdAt: "2026-03-20T10:00:00Z",
      author: {
        id: TEST_USER.id,
        username: TEST_USER.username,
        displayName: TEST_USER.displayName,
        name: TEST_USER.name,
        image: null,
        avatar: TEST_USER.avatar,
        profileFrameId: TEST_USER.profileFrameId,
        usernameFont: TEST_USER.usernameFont,
      },
    };

    const { container } = render(
      <MediaGrid initialPosts={[post]} initialHasMore={false} />
    );

    // MediaGrid shows avatars at size 20, which is below the 24px minimum
    // for frame overlays. Verify FramedAvatar renders the avatar image
    // inside its wrapper div (not a raw <img>).
    const avatarWrapper = container.querySelector(
      ".relative.inline-flex"
    );
    expect(avatarWrapper).toBeInTheDocument();
    const avatarImg = avatarWrapper?.querySelector("img");
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute("src", TEST_USER.avatar);
  });
});

// =====================================================================
// 3. AccountSwitcher
// =====================================================================
describe("AccountSwitcher — font & frame consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  vi.mock("next-auth/react", () => ({
    useSession: vi.fn(),
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  }));

  vi.mock("@/app/profile/account-linking-actions", () => ({
    switchAccount: vi.fn(),
  }));

  vi.mock("@/app/providers", () => ({
    useAblyReady: vi.fn().mockReturnValue(false),
  }));

  vi.mock("@/lib/ably", () => ({
    getAblyRealtimeClient: vi.fn(),
  }));

  vi.mock("@/app/notifications/actions", () => ({
    getLinkedAccountNotificationCounts: vi.fn().mockResolvedValue({}),
  }));

  it("uses FramedAvatar for linked account avatars and StyledName for names", async () => {
    const { useSession } = await import("next-auth/react");
    const { AccountSwitcher } = await import("@/components/account-switcher");
    const { fireEvent } = await import("@testing-library/react");

    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          id: "user-current",
          username: "current_user",
          displayName: "Current User",
          avatar: null,
          bio: null,
          tier: "free",
          isEmailVerified: true,
          authProvider: "credentials",
          profileFrameId: null,
          usernameFont: null,
          linkedAccounts: [
            {
              id: TEST_USER.id,
              username: TEST_USER.username,
              displayName: TEST_USER.displayName,
              avatar: TEST_USER.avatar,
              profileFrameId: TEST_USER.profileFrameId,
              usernameFont: TEST_USER.usernameFont,
            },
          ],
        },
        expires: "2026-12-31",
      },
      status: "authenticated",
      update: vi.fn(),
    });

    const { container } = render(<AccountSwitcher />);
    fireEvent.click(screen.getByTestId("account-switcher-button"));

    // Linked account name should have StyledName
    const nameEl = screen.getByText("Alice Wonder");
    expectStyledFont(nameEl);

    // Linked account avatar should use FramedAvatar with frame overlay
    const dropdown = screen.getByTestId("account-switcher-dropdown");
    expectFrameOverlay(dropdown);
  });
});
