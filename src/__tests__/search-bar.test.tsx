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

  it("does not show input by default", () => {
    render(<SearchBar />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("opens input when magnifying glass is clicked", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("navigates to /search on form submit with valid query", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));

    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.submit(input);

    expect(mockPush).toHaveBeenCalledWith("/search?q=hello");
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

  it("closes input on Escape key", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));

    const input = screen.getByRole("searchbox");
    expect(input).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("has aria-label on search input", () => {
    render(<SearchBar />);
    fireEvent.click(screen.getByLabelText("Open search"));
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });
});
