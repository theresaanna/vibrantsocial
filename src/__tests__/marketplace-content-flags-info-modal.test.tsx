import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MarketplaceContentFlagsInfoModal } from "@/components/marketplace-content-flags-info-modal";

describe("MarketplaceContentFlagsInfoModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with title", () => {
    render(<MarketplaceContentFlagsInfoModal onClose={vi.fn()} />);
    expect(
      screen.getByText("Marketplace Content Settings")
    ).toBeInTheDocument();
  });

  it("renders NSFW section with marketplace-specific description", () => {
    render(<MarketplaceContentFlagsInfoModal onClose={vi.fn()} />);
    expect(screen.getByText("NSFW")).toBeInTheDocument();
    expect(screen.getByText(/adult themes and nudity/)).toBeInTheDocument();
  });

  it("renders Graphic/Explicit section with marketplace-specific description", () => {
    render(<MarketplaceContentFlagsInfoModal onClose={vi.fn()} />);
    expect(screen.getByText("Graphic/Explicit")).toBeInTheDocument();
    expect(screen.getByText(/sex acts, graphic depictions/)).toBeInTheDocument();
  });

  it("does not render Sensitive section", () => {
    render(<MarketplaceContentFlagsInfoModal onClose={vi.fn()} />);
    const headings = screen.getAllByRole("heading");
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).not.toContain("Sensitive");
  });

  it("renders contact email link", () => {
    render(<MarketplaceContentFlagsInfoModal onClose={vi.fn()} />);
    const emailLink = screen.getByText("vibrantsocial@proton.me");
    expect(emailLink).toHaveAttribute("href", "mailto:vibrantsocial@proton.me");
  });

  it("calls onClose when clicking the close button", () => {
    const onClose = vi.fn();
    render(<MarketplaceContentFlagsInfoModal onClose={onClose} />);
    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when pressing Escape", () => {
    const onClose = vi.fn();
    render(<MarketplaceContentFlagsInfoModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking the backdrop", () => {
    const onClose = vi.fn();
    render(<MarketplaceContentFlagsInfoModal onClose={onClose} />);
    const backdrop = document.querySelector(".fixed.inset-0");
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the modal content", () => {
    const onClose = vi.fn();
    render(<MarketplaceContentFlagsInfoModal onClose={onClose} />);
    fireEvent.click(screen.getByText("Marketplace Content Settings"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders warning about illegal items", () => {
    render(<MarketplaceContentFlagsInfoModal onClose={vi.fn()} />);
    expect(
      screen.getByText(/No illegal items or materials/)
    ).toBeInTheDocument();
  });

  it("renders warning about failure to mark adult material", () => {
    render(<MarketplaceContentFlagsInfoModal onClose={vi.fn()} />);
    expect(
      screen.getByText(/Failure to mark adult material/)
    ).toBeInTheDocument();
  });

  it("is rendered as a portal into document.body", () => {
    render(<MarketplaceContentFlagsInfoModal onClose={vi.fn()} />);
    const modal = document.querySelector("body > .fixed.inset-0");
    expect(modal).toBeTruthy();
  });
});
