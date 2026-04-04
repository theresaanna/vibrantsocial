import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageOverlay } from "@/components/image-overlay";

describe("ImageOverlay", () => {
  const defaultProps = {
    src: "https://example.com/photo.jpg",
    alt: "A photo",
    onClose: vi.fn(),
  };

  it("renders the full-size image", () => {
    render(<ImageOverlay {...defaultProps} />);
    const img = screen.getByTestId("image-overlay-img");
    expect(img).toHaveAttribute("src", defaultProps.src);
    expect(img).toHaveAttribute("alt", defaultProps.alt);
  });

  it("calls onClose when clicking the backdrop", () => {
    const onClose = vi.fn();
    render(<ImageOverlay {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("image-overlay"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when clicking the image itself", () => {
    const onClose = vi.fn();
    render(<ImageOverlay {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("image-overlay-img"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when clicking the close button", () => {
    const onClose = vi.fn();
    render(<ImageOverlay {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("image-overlay-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when pressing Escape", () => {
    const onClose = vi.fn();
    render(<ImageOverlay {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
