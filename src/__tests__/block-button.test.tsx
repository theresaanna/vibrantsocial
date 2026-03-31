import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlockButton } from "@/components/block-button";

vi.mock("@/app/feed/block-actions", () => ({
  toggleBlock: vi.fn(),
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

describe("BlockButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with subtle zinc styling when not blocked", () => {
    render(<BlockButton userId="u1" isBlocked={false} />);
    const btn = screen.getByTestId("profile-block-button");
    expect(btn.className).toContain("text-zinc-400");
  });

  it("renders with red styling when blocked", () => {
    render(<BlockButton userId="u1" isBlocked={true} />);
    const btn = screen.getByTestId("profile-block-button");
    expect(btn.className).toContain("text-red-500");
  });

  it("has title 'Block user' when not blocked", () => {
    render(<BlockButton userId="u1" isBlocked={false} />);
    const btn = screen.getByTestId("profile-block-button");
    expect(btn).toHaveAttribute("title", "Block user");
  });

  it("has title 'Unblock user' when blocked", () => {
    render(<BlockButton userId="u1" isBlocked={true} />);
    const btn = screen.getByTestId("profile-block-button");
    expect(btn).toHaveAttribute("title", "Unblock user");
  });

  it("shows confirmation dialog on click when not blocked (with block warning text)", async () => {
    const user = userEvent.setup();
    render(<BlockButton userId="u1" isBlocked={false} />);

    await user.click(screen.getByTestId("profile-block-button"));

    expect(screen.getByText("Block?")).toBeInTheDocument();
    expect(
      screen.getByText(/block this user\? They won't be able to see your content/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Block" })).toBeInTheDocument();
  });

  it("shows confirmation dialog on click when blocked (with unblock text)", async () => {
    const user = userEvent.setup();
    render(<BlockButton userId="u1" isBlocked={true} />);

    await user.click(screen.getByTestId("profile-block-button"));

    expect(screen.getByText("Unblock?")).toBeInTheDocument();
    expect(
      screen.getByText(/unblock this user\? They will be able to see your public content/)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unblock" })).toBeInTheDocument();
  });

  it("hides dialog on cancel", async () => {
    const user = userEvent.setup();
    render(<BlockButton userId="u1" isBlocked={false} />);

    await user.click(screen.getByTestId("profile-block-button"));
    expect(screen.getByText("Block?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Block?")).not.toBeInTheDocument();
  });

  it("has hidden userId input in form", () => {
    const { container } = render(<BlockButton userId="u1" isBlocked={false} />);
    const hidden = container.querySelector("input[name='userId']");
    expect(hidden).toBeInTheDocument();
    expect(hidden).toHaveAttribute("value", "u1");
    expect(hidden).toHaveAttribute("type", "hidden");
  });

  it("form has id block-form-{userId}", () => {
    const { container } = render(<BlockButton userId="u1" isBlocked={false} />);
    const form = container.querySelector("form#block-form-u1");
    expect(form).toBeInTheDocument();
  });

  it("has data-testid='profile-block-button'", () => {
    render(<BlockButton userId="u1" isBlocked={false} />);
    expect(screen.getByTestId("profile-block-button")).toBeInTheDocument();
  });

  it("has hidden blockByPhone input defaulting to false", () => {
    const { container } = render(<BlockButton userId="u1" isBlocked={false} />);
    const hidden = container.querySelector("input[name='blockByPhone']");
    expect(hidden).toBeInTheDocument();
    expect(hidden).toHaveAttribute("value", "false");
  });
});

describe("BlockButton phone blocking option", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show phone option when hasVerifiedPhone is false", async () => {
    const user = userEvent.setup();
    render(<BlockButton userId="u1" isBlocked={false} hasVerifiedPhone={false} />);

    await user.click(screen.getByTestId("profile-block-button"));

    expect(screen.queryByTestId("block-by-phone-option")).not.toBeInTheDocument();
  });

  it("does not show phone option when hasVerifiedPhone not provided", async () => {
    const user = userEvent.setup();
    render(<BlockButton userId="u1" isBlocked={false} />);

    await user.click(screen.getByTestId("profile-block-button"));

    expect(screen.queryByTestId("block-by-phone-option")).not.toBeInTheDocument();
  });

  it("does not show phone option when unblocking (even if hasVerifiedPhone)", async () => {
    const user = userEvent.setup();
    render(<BlockButton userId="u1" isBlocked={true} hasVerifiedPhone={true} />);

    await user.click(screen.getByTestId("profile-block-button"));

    expect(screen.queryByTestId("block-by-phone-option")).not.toBeInTheDocument();
  });

  it("shows phone option checkbox when blocking and target has verified phone", async () => {
    const user = userEvent.setup();
    render(<BlockButton userId="u1" isBlocked={false} hasVerifiedPhone={true} />);

    await user.click(screen.getByTestId("profile-block-button"));

    expect(screen.getByTestId("block-by-phone-option")).toBeInTheDocument();
    expect(screen.getByTestId("block-by-phone-checkbox")).toBeInTheDocument();
    expect(
      screen.getByText(/Also block all current and future accounts using the same phone number/)
    ).toBeInTheDocument();
  });

  it("checkbox is unchecked by default", async () => {
    const user = userEvent.setup();
    render(<BlockButton userId="u1" isBlocked={false} hasVerifiedPhone={true} />);

    await user.click(screen.getByTestId("profile-block-button"));

    const checkbox = screen.getByTestId("block-by-phone-checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("updates blockByPhone hidden input when checkbox is toggled", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BlockButton userId="u1" isBlocked={false} hasVerifiedPhone={true} />
    );

    await user.click(screen.getByTestId("profile-block-button"));

    // Initially false
    const hidden = container.querySelector("input[name='blockByPhone']") as HTMLInputElement;
    expect(hidden.value).toBe("false");

    // Check the checkbox
    await user.click(screen.getByTestId("block-by-phone-checkbox"));
    expect(hidden.value).toBe("true");

    // Uncheck
    await user.click(screen.getByTestId("block-by-phone-checkbox"));
    expect(hidden.value).toBe("false");
  });

  it("resets checkbox when dialog is reopened", async () => {
    const user = userEvent.setup();
    render(<BlockButton userId="u1" isBlocked={false} hasVerifiedPhone={true} />);

    // Open, check, cancel
    await user.click(screen.getByTestId("profile-block-button"));
    await user.click(screen.getByTestId("block-by-phone-checkbox"));
    expect(screen.getByTestId("block-by-phone-checkbox")).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    // Reopen — should be unchecked
    await user.click(screen.getByTestId("profile-block-button"));
    expect(screen.getByTestId("block-by-phone-checkbox")).not.toBeChecked();
  });
});
