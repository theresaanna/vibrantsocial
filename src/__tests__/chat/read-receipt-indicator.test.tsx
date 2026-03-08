import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadReceiptIndicator } from "@/components/chat/read-receipt-indicator";

describe("ReadReceiptIndicator", () => {
  it("shows check matching bg color for sent status", () => {
    render(<ReadReceiptIndicator status="sent" />);
    const indicator = screen.getByLabelText("Sent");
    expect(indicator).toBeInTheDocument();
    expect(indicator.className).toContain("text-blue-500");
  });

  it("shows check matching bg color for delivered status", () => {
    render(<ReadReceiptIndicator status="delivered" />);
    const indicator = screen.getByLabelText("Delivered");
    expect(indicator).toBeInTheDocument();
    expect(indicator.className).toContain("text-blue-500");
  });

  it("shows check matching text color for read status", () => {
    render(<ReadReceiptIndicator status="read" />);
    const indicator = screen.getByLabelText("Read");
    expect(indicator).toBeInTheDocument();
    expect(indicator.className).toContain("text-white");
  });

  it("uses CSS variable for bubble bg when custom themed (unread)", () => {
    render(<ReadReceiptIndicator status="sent" hasCustomTheme />);
    const indicator = screen.getByLabelText("Sent");
    expect(indicator.style.color).toBe("var(--chat-bubble-bg)");
  });

  it("uses CSS variable for bubble text when custom themed (read)", () => {
    render(<ReadReceiptIndicator status="read" hasCustomTheme />);
    const indicator = screen.getByLabelText("Read");
    expect(indicator.style.color).toBe("var(--chat-bubble-text)");
  });
});
