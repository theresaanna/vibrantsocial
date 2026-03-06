import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PresenceIndicator } from "@/components/chat/presence-indicator";

describe("PresenceIndicator", () => {
  it("renders green dot when online", () => {
    render(<PresenceIndicator isOnline={true} />);
    const dot = screen.getByLabelText("Online");
    expect(dot).toBeInTheDocument();
    expect(dot.className).toContain("bg-green-500");
  });

  it("renders gray dot when offline", () => {
    render(<PresenceIndicator isOnline={false} />);
    const dot = screen.getByLabelText("Offline");
    expect(dot).toBeInTheDocument();
    expect(dot.className).toContain("bg-zinc-300");
  });

  it("applies sm size by default", () => {
    render(<PresenceIndicator isOnline={true} />);
    const dot = screen.getByLabelText("Online");
    expect(dot.className).toContain("h-2.5");
    expect(dot.className).toContain("w-2.5");
  });

  it("applies md size when specified", () => {
    render(<PresenceIndicator isOnline={true} size="md" />);
    const dot = screen.getByLabelText("Online");
    expect(dot.className).toContain("h-3");
    expect(dot.className).toContain("w-3");
  });
});
