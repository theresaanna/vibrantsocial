import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContentFlagsInfoModal } from "@/components/content-flags-info-modal";

describe("ContentFlagsInfoModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with title", () => {
    render(<ContentFlagsInfoModal onClose={vi.fn()} />);
    expect(
      screen.getByText("Adult and Sensitive Content Settings")
    ).toBeInTheDocument();
  });

  it("renders NSFW section", () => {
    render(<ContentFlagsInfoModal onClose={vi.fn()} />);
    expect(screen.getByText("NSFW")).toBeInTheDocument();
  });

  it("renders Sensitive section", () => {
    render(<ContentFlagsInfoModal onClose={vi.fn()} />);
    expect(screen.getByText("Sensitive")).toBeInTheDocument();
  });

  it("renders Graphic/Explicit section", () => {
    render(<ContentFlagsInfoModal onClose={vi.fn()} />);
    expect(screen.getByText("Graphic/Explicit")).toBeInTheDocument();
  });

  it("renders contact email link", () => {
    render(<ContentFlagsInfoModal onClose={vi.fn()} />);
    const emailLink = screen.getByText("vibrantsocial@proton.me");
    expect(emailLink).toHaveAttribute("href", "mailto:vibrantsocial@proton.me");
  });

  it("calls onClose when clicking the close button", () => {
    const onClose = vi.fn();
    render(<ContentFlagsInfoModal onClose={onClose} />);
    // The close button is the one with the X icon
    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when pressing Escape", () => {
    const onClose = vi.fn();
    render(<ContentFlagsInfoModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking the backdrop", () => {
    const onClose = vi.fn();
    render(<ContentFlagsInfoModal onClose={onClose} />);
    // The backdrop is the outer fixed overlay
    const backdrop = document.querySelector(".fixed.inset-0");
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the modal content", () => {
    const onClose = vi.fn();
    render(<ContentFlagsInfoModal onClose={onClose} />);
    fireEvent.click(
      screen.getByText("Adult and Sensitive Content Settings")
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders warning about account deactivation", () => {
    render(<ContentFlagsInfoModal onClose={vi.fn()} />);
    expect(
      screen.getByText(/deactivation of your account/)
    ).toBeInTheDocument();
  });

  it("renders warning about illegal media", () => {
    render(<ContentFlagsInfoModal onClose={vi.fn()} />);
    expect(
      screen.getByText(/No illegal media or hate speech/)
    ).toBeInTheDocument();
  });

  it("is rendered as a portal into document.body", () => {
    render(<ContentFlagsInfoModal onClose={vi.fn()} />);
    // The modal should be a direct child of body, not inside the render container
    const modal = document.querySelector("body > .fixed.inset-0");
    expect(modal).toBeTruthy();
  });
});
