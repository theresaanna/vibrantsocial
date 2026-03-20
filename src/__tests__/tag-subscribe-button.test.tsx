import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockToggleTagSubscription = vi.fn();
const mockUpdateTagSubscriptionEmail = vi.fn();

vi.mock("@/app/feed/tag-subscription-actions", () => ({
  toggleTagSubscription: (...args: unknown[]) =>
    mockToggleTagSubscription(...args),
  updateTagSubscriptionEmail: (...args: unknown[]) =>
    mockUpdateTagSubscriptionEmail(...args),
}));

import { TagSubscribeButton } from "@/app/tag/[name]/tag-subscribe-button";

const defaultProps = {
  tagId: "tag-123",
  tagName: "javascript",
  initialSubscribed: false,
  initialFrequency: "immediate",
  initialEmailNotification: false,
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

  it("does not show email checkbox or frequency select when not subscribed", () => {
    render(<TagSubscribeButton {...defaultProps} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
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

  it("shows email checkbox when subscribed", () => {
    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
      />
    );
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("does not show frequency select when subscribed but email disabled", () => {
    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialEmailNotification={false}
      />
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows frequency select when subscribed and email enabled", () => {
    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialEmailNotification={true}
      />
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows Immediate and Daily Digest options when email enabled", () => {
    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialEmailNotification={true}
      />
    );
    expect(screen.getByText("Immediate")).toBeInTheDocument();
    expect(screen.getByText("Daily Digest")).toBeInTheDocument();
  });

  it("selects initial frequency when email enabled", () => {
    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialEmailNotification={true}
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

    expect(screen.getByText("Subscribe")).toBeInTheDocument();
  });

  // ─── Email toggle ──────────────────────────────────────────

  it("toggles email on when checkbox clicked", async () => {
    mockUpdateTagSubscriptionEmail.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialEmailNotification={false}
      />
    );

    await act(async () => {
      await user.click(screen.getByRole("checkbox"));
    });

    expect(mockUpdateTagSubscriptionEmail).toHaveBeenCalledWith(
      "tag-123",
      true,
      "immediate"
    );
  });

  it("toggles email off when checkbox unchecked", async () => {
    mockUpdateTagSubscriptionEmail.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialEmailNotification={true}
      />
    );

    await act(async () => {
      await user.click(screen.getByRole("checkbox"));
    });

    expect(mockUpdateTagSubscriptionEmail).toHaveBeenCalledWith(
      "tag-123",
      false,
      undefined
    );
  });

  it("reverts email toggle on failure", async () => {
    mockUpdateTagSubscriptionEmail.mockResolvedValue({ success: false });
    const user = userEvent.setup();

    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialEmailNotification={false}
      />
    );

    await act(async () => {
      await user.click(screen.getByRole("checkbox"));
    });

    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  // ─── Frequency change ─────────────────────────────────────

  it("updates frequency on select change", async () => {
    mockUpdateTagSubscriptionEmail.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialEmailNotification={true}
        initialFrequency="immediate"
      />
    );

    await act(async () => {
      await user.selectOptions(screen.getByRole("combobox"), "digest");
    });

    expect(mockUpdateTagSubscriptionEmail).toHaveBeenCalledWith(
      "tag-123",
      true,
      "digest"
    );
  });

  it("reverts frequency on failure", async () => {
    mockUpdateTagSubscriptionEmail.mockResolvedValue({
      success: false,
    });
    const user = userEvent.setup();

    render(
      <TagSubscribeButton
        {...defaultProps}
        initialSubscribed={true}
        initialEmailNotification={true}
        initialFrequency="immediate"
      />
    );

    await act(async () => {
      await user.selectOptions(screen.getByRole("combobox"), "digest");
    });

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
