import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockToggleTagSubscription = vi.fn();
const mockUpdateTagSubscriptionFrequency = vi.fn();

vi.mock("@/app/feed/tag-subscription-actions", () => ({
  toggleTagSubscription: (...args: unknown[]) =>
    mockToggleTagSubscription(...args),
  updateTagSubscriptionFrequency: (...args: unknown[]) =>
    mockUpdateTagSubscriptionFrequency(...args),
}));

import { TagSubscribeButton } from "@/app/tag/[name]/tag-subscribe-button";

const defaultProps = {
  tagId: "tag-123",
  tagName: "javascript",
  initialSubscribed: false,
  initialFrequency: "immediate",
};

describe("TagSubscribeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Unsubscribed state ────────────────────────────────────

  it("renders Subscribe button when not subscribed", () => {
    render(<TagSubscribeButton {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /subscribe to #javascript/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Subscribe")).toBeInTheDocument();
  });

  it("does not show frequency select when not subscribed", () => {
    render(<TagSubscribeButton {...defaultProps} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  // ─── Subscribed state ──────────────────────────────────────

  it("renders Subscribed button when subscribed", () => {
    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
      />
    );
    expect(
      screen.getByRole("button", { name: /unsubscribe from #javascript/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Subscribed")).toBeInTheDocument();
  });

  it("shows frequency select when subscribed", () => {
    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
      />
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows Immediate and Daily Digest options", () => {
    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
      />
    );
    expect(screen.getByText("Immediate")).toBeInTheDocument();
    expect(screen.getByText("Daily Digest")).toBeInTheDocument();
  });

  it("selects initial frequency", () => {
    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialFrequency="digest"
      />
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("digest");
  });

  // ─── Toggle subscribe ──────────────────────────────────────

  it("toggles to subscribed on click", async () => {
    mockToggleTagSubscription.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(<TagSubscribeButton {...defaultProps} />);

    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: /subscribe to #javascript/i })
      );
    });

    // Optimistically shows subscribed
    expect(screen.getByText("Subscribed")).toBeInTheDocument();
  });

  it("toggles to unsubscribed on click", async () => {
    mockToggleTagSubscription.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
      />
    );

    await act(async () => {
      await user.click(
        screen.getByRole("button", {
          name: /unsubscribe from #javascript/i,
        })
      );
    });

    // Optimistically shows unsubscribed
    expect(screen.getByText("Subscribe")).toBeInTheDocument();
  });

  it("reverts optimistic toggle on failure", async () => {
    mockToggleTagSubscription.mockResolvedValue({ success: false });
    const user = userEvent.setup();

    render(<TagSubscribeButton {...defaultProps} />);

    await act(async () => {
      await user.click(
        screen.getByRole("button", { name: /subscribe to #javascript/i })
      );
    });

    // Should revert back to Subscribe
    expect(screen.getByText("Subscribe")).toBeInTheDocument();
  });

  // ─── Frequency change ─────────────────────────────────────

  it("updates frequency on select change", async () => {
    mockUpdateTagSubscriptionFrequency.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialFrequency="immediate"
      />
    );

    await act(async () => {
      await user.selectOptions(screen.getByRole("combobox"), "digest");
    });

    expect(mockUpdateTagSubscriptionFrequency).toHaveBeenCalledWith(
      "tag-123",
      "digest"
    );
  });

  it("reverts frequency on failure", async () => {
    mockUpdateTagSubscriptionFrequency.mockResolvedValue({
      success: false,
    });
    const user = userEvent.setup();

    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialFrequency="immediate"
      />
    );

    await act(async () => {
      await user.selectOptions(screen.getByRole("combobox"), "digest");
    });

    // Should revert back to immediate
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("immediate");
  });

  // ─── Aria labels ───────────────────────────────────────────

  it("has correct aria-label for subscribe", () => {
    render(<TagSubscribeButton {...defaultProps} />);
    expect(
      screen.getByLabelText("Subscribe to #javascript")
    ).toBeInTheDocument();
  });

  it("has correct aria-label for unsubscribe", () => {
    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
      />
    );
    expect(
      screen.getByLabelText("Unsubscribe from #javascript")
    ).toBeInTheDocument();
  });
});
