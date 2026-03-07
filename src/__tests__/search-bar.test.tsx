import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

import { SearchBar } from "@/components/search-bar";

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a magnifying glass button", () => {
    render(<SearchBar />);
    expect(screen.getByLabelText("Open search")).toBeInTheDocument();
  });

  it("popup is hidden by default", () => {
    render(<SearchBar />);
    // The input is always in the DOM but the popup container is visually hidden
    const input = screen.getByLabelText("Search");
    const popup = input.closest("[class*='absolute']")!;
    expect(popup.className).toContain("opacity-0");
    expect(popup.className).toContain("pointer-events-none");
  });

  it("opens popup when magnifying glass is clicked", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));

    const input = screen.getByLabelText("Search");
    const popup = input.closest("[class*='absolute']")!;
    expect(popup.className).toContain("opacity-100");
    expect(popup.className).toContain("pointer-events-auto");
  });

  it("navigates to /search on form submit with valid query", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.submit(input);

    expect(mockPush).toHaveBeenCalledWith("/search?q=hello");
  });

  it("closes popup after successful submit", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.submit(input);

    const popup = input.closest("[class*='absolute']")!;
    expect(popup.className).toContain("opacity-0");
  });

  it("does not navigate with empty query", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));

    const input = screen.getByRole("searchbox");
    fireEvent.submit(input);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not navigate with single character query", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.submit(input);

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("encodes special characters in URL", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "hello world" } });
    fireEvent.submit(input);

    expect(mockPush).toHaveBeenCalledWith("/search?q=hello%20world");
  });

  it("closes popup on Escape key", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));

    const input = screen.getByRole("searchbox");
    const popup = input.closest("[class*='absolute']")!;
    expect(popup.className).toContain("opacity-100");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(popup.className).toContain("opacity-0");
  });

  it("closes popup when clicking outside", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));

    const input = screen.getByLabelText("Search");
    const popup = input.closest("[class*='absolute']")!;
    expect(popup.className).toContain("opacity-100");

    fireEvent.mouseDown(document.body);
    expect(popup.className).toContain("opacity-0");
  });

  it("has aria-label on search input", () => {
    render(<SearchBar />);
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });

  it("shows hint text about pressing Enter", () => {
    render(<SearchBar />);
    expect(screen.getByText("Press Enter to search")).toBeInTheDocument();
  });
});
