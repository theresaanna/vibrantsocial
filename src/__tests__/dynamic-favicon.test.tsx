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
    // Clean up any favicon links
    document.querySelectorAll("link[rel='icon']").forEach((el) => el.remove());
  });

  it("renders nothing visually (returns null)", () => {
    const { container } = render(
      <DynamicFavicon initialHasUnread={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("creates a favicon link element on mount", () => {
    render(<DynamicFavicon initialHasUnread={false} />);
    const link = document.querySelector("link[rel='icon']");
    expect(link).toBeTruthy();
  });

  it("sets default favicon when no unread", () => {
    render(<DynamicFavicon initialHasUnread={false} />);
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    expect(link?.href).toContain("svg");
    expect(link?.href).not.toContain("bell");
  });

  it("sets alert favicon when there are unread notifications", () => {
    render(<DynamicFavicon initialHasUnread={true} />);
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    expect(link?.href).toContain("svg");
  });

  it("updates existing favicon links instead of creating new ones", () => {
    // Pre-create a favicon link
    const existingLink = document.createElement("link");
    existingLink.rel = "icon";
    existingLink.href = "old-favicon.ico";
    document.head.appendChild(existingLink);

    render(<DynamicFavicon initialHasUnread={false} />);
    const links = document.querySelectorAll("link[rel='icon']");
    // Should update the existing one, not create a new one
    expect(links).toHaveLength(1);
    expect((links[0] as HTMLLinkElement).type).toBe("image/svg+xml");
  });

  it("sets favicon type to image/svg+xml", () => {
    render(<DynamicFavicon initialHasUnread={false} />);
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    expect(link?.type).toBe("image/svg+xml");
  });
});
