import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubscribeButton } from "@/components/subscribe-button";

const mockTogglePostSubscription = vi.fn().mockResolvedValue({ success: false, message: "" });

vi.mock("@/app/feed/subscription-actions", () => ({
  togglePostSubscription: (...args: unknown[]) =>
    mockTogglePostSubscription(...args),
}));

describe("SubscribeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Subscribe' when not subscribed", () => {
    render(<SubscribeButton userId="user1" isSubscribed={false} />);
    expect(
      screen.getByRole("button", { name: /Subscribe/ })
    ).toBeInTheDocument();
  });

  it("renders 'Subscribed' when subscribed", () => {
    render(<SubscribeButton userId="user1" isSubscribed={true} />);
    expect(
      screen.getByRole("button", { name: /Subscribed/ })
    ).toBeInTheDocument();
  });

  it("shows correct title when not subscribed", () => {
    render(<SubscribeButton userId="user1" isSubscribed={false} />);
    expect(screen.getByTitle("Get notified of new posts")).toBeInTheDocument();
  });

  it("shows correct title when subscribed", () => {
    render(<SubscribeButton userId="user1" isSubscribed={true} />);
    expect(
      screen.getByTitle("Unsubscribe from new posts")
    ).toBeInTheDocument();
  });

  it("has submit type on the button", () => {
    render(<SubscribeButton userId="user1" isSubscribed={false} />);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("includes hidden userId input", () => {
    const { container } = render(
      <SubscribeButton userId="user1" isSubscribed={false} />
    );
    const hidden = container.querySelector("input[name='userId']");
    expect(hidden).toHaveAttribute("value", "user1");
  });

  it("applies different styling when subscribed vs not", () => {
    const { rerender } = render(
      <SubscribeButton userId="user1" isSubscribed={false} />
    );
    const unsubButton = screen.getByRole("button");
    expect(unsubButton.className).toContain("rounded-full");
    expect(unsubButton.className).toContain("border");

    rerender(<SubscribeButton userId="user1" isSubscribed={true} />);
    const subButton = screen.getByRole("button");
    expect(subButton.className).toContain("bg-indigo-600");
  });
});
