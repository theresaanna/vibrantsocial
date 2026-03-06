import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReadReceiptIndicator } from "@/components/chat/read-receipt-indicator";

describe("ReadReceiptIndicator", () => {
  it("shows single check for sent status", () => {
    render(<ReadReceiptIndicator status="sent" />);
    const indicator = screen.getByLabelText("Sent");
    expect(indicator).toBeInTheDocument();
    expect(indicator.className).toContain("text-zinc-400");
  });

  it("shows double gray checks for delivered status", () => {
    render(<ReadReceiptIndicator status="delivered" />);
    const indicator = screen.getByLabelText("Delivered");
    expect(indicator).toBeInTheDocument();
    expect(indicator.className).toContain("text-zinc-400");
  });

  it("shows double blue checks for read status", () => {
    render(<ReadReceiptIndicator status="read" />);
    const indicator = screen.getByLabelText("Read");
    expect(indicator).toBeInTheDocument();
    expect(indicator.className).toContain("text-blue-500");
  });
});
