import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSearchTags = vi.fn();

vi.mock("@/app/tags/actions", () => ({
  searchTags: (...args: unknown[]) => mockSearchTags(...args),
}));

vi.mock("@/lib/tags", () => ({
  normalizeTag: (raw: string) =>
    raw.trim().toLowerCase().replace(/^#/, "").replace(/[^a-z0-9-]/g, "").slice(0, 50),
}));

import { TagInput } from "@/components/tag-input";

describe("TagInput", () => {
  const defaultProps = {
    tags: [] as string[],
    onChange: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchTags.mockResolvedValue([]);
  });

  it("renders input field", () => {
    render(<TagInput {...defaultProps} />);
    expect(screen.getByTestId("tag-input")).toBeInTheDocument();
  });

  it("renders existing tags as chips", () => {
    render(<TagInput {...defaultProps} tags={["react", "nextjs"]} />);
    expect(screen.getByText("#react")).toBeInTheDocument();
    expect(screen.getByText("#nextjs")).toBeInTheDocument();
  });

  it("renders nothing when disabled", () => {
    const { container } = render(<TagInput {...defaultProps} disabled={true} />);
    expect(container.innerHTML).toBe("");
  });

  it("adds tag on Enter key", async () => {
    const onChange = vi.fn();
    render(<TagInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "react" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(["react"]);
  });

  it("adds tag on comma key", () => {
    const onChange = vi.fn();
    render(<TagInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "typescript" } });
    fireEvent.keyDown(input, { key: "," });

    expect(onChange).toHaveBeenCalledWith(["typescript"]);
  });

  it("removes tag when clicking remove button", () => {
    const onChange = vi.fn();
    render(<TagInput {...defaultProps} tags={["react", "vue"]} onChange={onChange} />);

    const removeButton = screen.getByLabelText("Remove tag react");
    fireEvent.click(removeButton);

    expect(onChange).toHaveBeenCalledWith(["vue"]);
  });

  it("removes last tag on Backspace when input is empty", () => {
    const onChange = vi.fn();
    render(<TagInput {...defaultProps} tags={["react", "vue"]} onChange={onChange} />);

    const input = screen.getByTestId("tag-input");
    fireEvent.keyDown(input, { key: "Backspace" });

    expect(onChange).toHaveBeenCalledWith(["react"]);
  });

  it("does not add duplicate tags", () => {
    const onChange = vi.fn();
    render(<TagInput {...defaultProps} tags={["react"]} onChange={onChange} />);

    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "react" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows typeahead suggestions after debounce", async () => {
    mockSearchTags.mockResolvedValue([
      { id: "t1", name: "react", count: 5 },
      { id: "t2", name: "reactnative", count: 3 },
    ]);

    render(<TagInput {...defaultProps} />);

    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "rea" } });

    // Wait for debounce + async resolution
    await waitFor(
      () => {
        expect(screen.getByTestId("tag-suggestions")).toBeInTheDocument();
        expect(screen.getByTestId("tag-suggestion-react")).toBeInTheDocument();
        expect(screen.getByTestId("tag-suggestion-reactnative")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("includes hidden input with comma-joined tags", () => {
    render(<TagInput {...defaultProps} tags={["react", "typescript"]} />);

    const hiddenInput = document.querySelector('input[name="tags"]') as HTMLInputElement;
    expect(hiddenInput).toBeTruthy();
    expect(hiddenInput.value).toBe("react,typescript");
  });

  it("normalizes tags before adding", () => {
    const onChange = vi.fn();
    render(<TagInput {...defaultProps} onChange={onChange} />);

    const input = screen.getByTestId("tag-input");
    fireEvent.change(input, { target: { value: "#REACT" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(["react"]);
  });
});
