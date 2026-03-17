import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { DynamicFavicon } from "@/components/dynamic-favicon";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn().mockReturnValue({
    data: { user: { id: "user1" } },
  }),
}));

vi.mock("@/app/providers", () => ({
  useAblyReady: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: vi.fn(),
}));

const mockGetUnreadNotificationCount = vi.fn().mockResolvedValue(0);
const mockGetConversations = vi.fn().mockResolvedValue([]);

vi.mock("@/app/notifications/actions", () => ({
  getUnreadNotificationCount: (...args: unknown[]) =>
    mockGetUnreadNotificationCount(...args),
}));

vi.mock("@/app/chat/actions", () => ({
  getConversations: (...args: unknown[]) => mockGetConversations(...args),
}));

describe("DynamicFavicon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/feed");
    document.querySelectorAll("link[rel='icon']").forEach((el) => el.remove());
    document.title = "VibrantSocial";
  });

  it("renders nothing visually (returns null)", () => {
    const { container } = render(
      <DynamicFavicon initialHasUnread={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("creates a favicon link element on mount", () => {
    render(<DynamicFavicon initialHasUnread={false} />);
    const link = document.querySelector("link[rel='icon']");
    expect(link).toBeTruthy();
  });

  it("sets favicon to static PNG", () => {
    render(<DynamicFavicon initialHasUnread={false} />);
    const link = document.querySelector(
      "link[rel='icon']",
    ) as HTMLLinkElement;
    expect(link?.href).toContain("icon-32.png");
    expect(link?.type).toBe("image/png");
  });

  it("prepends unread count to page title when there are unreads", async () => {
    mockGetUnreadNotificationCount.mockResolvedValue(3);
    mockGetConversations.mockResolvedValue([
      { unreadCount: 2 },
    ]);
    render(<DynamicFavicon initialHasUnread={true} />);
    // Wait for async fetch
    await vi.waitFor(() => {
      expect(document.title).toBe("(5) VibrantSocial");
    });
  });

  it("does not prepend count when there are no unreads", async () => {
    mockGetUnreadNotificationCount.mockResolvedValue(0);
    mockGetConversations.mockResolvedValue([]);
    render(<DynamicFavicon initialHasUnread={false} />);
    await vi.waitFor(() => {
      expect(document.title).toBe("VibrantSocial");
    });
  });

  it("strips existing count prefix before updating", async () => {
    document.title = "(2) VibrantSocial";
    mockGetUnreadNotificationCount.mockResolvedValue(7);
    mockGetConversations.mockResolvedValue([]);
    render(<DynamicFavicon initialHasUnread={true} />);
    await vi.waitFor(() => {
      expect(document.title).toBe("(7) VibrantSocial");
    });
  });

  it("updates existing favicon links instead of creating new ones", () => {
    const existingLink = document.createElement("link");
    existingLink.rel = "icon";
    existingLink.href = "old-favicon.ico";
    document.head.appendChild(existingLink);

    render(<DynamicFavicon initialHasUnread={false} />);
    const links = document.querySelectorAll("link[rel='icon']");
    expect(links).toHaveLength(1);
    expect((links[0] as HTMLLinkElement).type).toBe("image/png");
  });
});
