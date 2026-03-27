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

describe("DynamicFavicon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePathname).mockReturnValue("/feed");
    document.querySelectorAll("link[rel='icon']").forEach((el) => el.remove());
    document.title = "VibrantSocial";
  });

  it("renders nothing visually (returns null)", () => {
    const { container } = render(
      <DynamicFavicon initialNotifCount={0} initialChatCount={0} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("creates a favicon link element on mount", () => {
    render(<DynamicFavicon initialNotifCount={0} initialChatCount={0} />);
    const link = document.querySelector("link[rel='icon']");
    expect(link).toBeTruthy();
  });

  it("sets favicon to static PNG", () => {
    render(<DynamicFavicon initialNotifCount={0} initialChatCount={0} />);
    const link = document.querySelector(
      "link[rel='icon']",
    ) as HTMLLinkElement;
    expect(link?.href).toContain("icon-32.png");
    expect(link?.type).toBe("image/png");
  });

  it("shows aggregate count of notifications and chats in title", () => {
    render(<DynamicFavicon initialNotifCount={3} initialChatCount={2} />);
    expect(document.title).toBe("(5) VibrantSocial");
  });

  it("shows only notification count when no chat unreads", () => {
    render(<DynamicFavicon initialNotifCount={7} initialChatCount={0} />);
    expect(document.title).toBe("(7) VibrantSocial");
  });

  it("shows only chat count when no notification unreads", () => {
    render(<DynamicFavicon initialNotifCount={0} initialChatCount={4} />);
    expect(document.title).toBe("(4) VibrantSocial");
  });

  it("does not prepend count when there are no unreads", () => {
    render(<DynamicFavicon initialNotifCount={0} initialChatCount={0} />);
    expect(document.title).toBe("VibrantSocial");
  });

  it("strips existing count prefix before updating", () => {
    document.title = "(2) VibrantSocial";
    render(<DynamicFavicon initialNotifCount={7} initialChatCount={3} />);
    expect(document.title).toBe("(10) VibrantSocial");
  });

  it("updates existing favicon links instead of creating new ones", () => {
    const existingLink = document.createElement("link");
    existingLink.rel = "icon";
    existingLink.href = "old-favicon.ico";
    document.head.appendChild(existingLink);

    render(<DynamicFavicon initialNotifCount={0} initialChatCount={0} />);
    const links = document.querySelectorAll("link[rel='icon']");
    expect(links).toHaveLength(1);
    expect((links[0] as HTMLLinkElement).type).toBe("image/png");
  });
});
