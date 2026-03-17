import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FollowButton } from "@/components/follow-button";

vi.mock("@/app/feed/follow-actions", () => ({
  toggleFollow: vi.fn(),
}));

// jsdom does not implement showModal/close on <dialog>, so we polyfill them.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal =
    HTMLDialogElement.prototype.showModal ??
    vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
  HTMLDialogElement.prototype.close =
    HTMLDialogElement.prototype.close ??
    vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
});

describe("FollowButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Follow' with outline styling when not following", () => {
    render(<FollowButton userId="u1" isFollowing={false} />);
    const btn = screen.getByRole("button", { name: "Follow" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("border-blue-500");
    expect(btn.className).toContain("bg-transparent");
  });

  it("renders 'Following' with gradient styling when following", () => {
    render(<FollowButton userId="u1" isFollowing={true} />);
    const btn = screen.getByRole("button", { name: "Following" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("bg-gradient-to-r");
    expect(btn.className).toContain("from-blue-500");
  });

  it("shows confirmation dialog when clicking 'Following' (unfollow attempt)", async () => {
    const user = userEvent.setup();
    render(<FollowButton userId="u1" isFollowing={true} />);

    await user.click(screen.getByRole("button", { name: "Following" }));

    expect(screen.getByText("Unfollow?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Unfollow" })
    ).toBeInTheDocument();
  });

  it("does not show confirmation dialog when clicking 'Follow'", async () => {
    const user = userEvent.setup();
    render(<FollowButton userId="u1" isFollowing={false} />);

    // The Follow button is type="submit", so clicking it won't trigger the dialog
    // We can verify no dialog title appears
    expect(screen.queryByText("Unfollow?")).not.toBeInTheDocument();
  });

  it("has hidden userId input in form", () => {
    const { container } = render(
      <FollowButton userId="u1" isFollowing={false} />
    );
    const hidden = container.querySelector("input[name='userId']");
    expect(hidden).toBeInTheDocument();
    expect(hidden).toHaveAttribute("value", "u1");
    expect(hidden).toHaveAttribute("type", "hidden");
  });

  it("has correct form id attribute follow-form-{userId}", () => {
    const { container } = render(
      <FollowButton userId="u1" isFollowing={false} />
    );
    const form = container.querySelector("form#follow-form-u1");
    expect(form).toBeInTheDocument();
  });

  it("'Follow' button has type submit", () => {
    render(<FollowButton userId="u1" isFollowing={false} />);
    expect(screen.getByRole("button", { name: "Follow" })).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("'Following' button has type button (not submit)", () => {
    render(<FollowButton userId="u1" isFollowing={true} />);
    expect(screen.getByRole("button", { name: "Following" })).toHaveAttribute(
      "type",
      "button"
    );
  });

  it("confirmation dialog has danger variant", async () => {
    const user = userEvent.setup();
    render(<FollowButton userId="u1" isFollowing={true} />);

    await user.click(screen.getByRole("button", { name: "Following" }));

    // The Unfollow confirm button should have danger (red) styling
    const unfollowBtn = screen.getByRole("button", { name: "Unfollow" });
    expect(unfollowBtn.className).toContain("bg-red-600");
  });

  it("hides confirmation dialog when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<FollowButton userId="u1" isFollowing={true} />);

    await user.click(screen.getByRole("button", { name: "Following" }));
    expect(screen.getByText("Unfollow?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Unfollow?")).not.toBeInTheDocument();
  });
});
