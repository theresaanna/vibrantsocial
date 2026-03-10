import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSuggestTags = vi.fn();

vi.mock("@/app/feed/auto-tag-action", () => ({
  suggestTags: (...args: unknown[]) => mockSuggestTags(...args),
}));

import { AutoTagButton } from "@/components/auto-tag-button";

describe("AutoTagButton", () => {
  const defaultProps = {
    editorJson: '{"root":{"children":[{"type":"paragraph","children":[{"type":"text","text":"Hello"}]}]}}',
    existingTags: [] as string[],
    onTagsSuggested: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the button", () => {
    render(<AutoTagButton {...defaultProps} />);
    expect(screen.getByTestId("auto-tag-button")).toBeInTheDocument();
  });

  it("is disabled when editorJson is empty", () => {
    render(<AutoTagButton {...defaultProps} editorJson="" />);
    expect(screen.getByTestId("auto-tag-button")).toBeDisabled();
  });

  it("is disabled when disabled prop is true", () => {
    render(<AutoTagButton {...defaultProps} disabled />);
    expect(screen.getByTestId("auto-tag-button")).toBeDisabled();
  });

  it("calls suggestTags with editorJson on click", async () => {
    mockSuggestTags.mockResolvedValue({
      success: true,
      tags: ["sunset"],
    });

    render(<AutoTagButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("auto-tag-button"));

    await waitFor(() => {
      expect(mockSuggestTags).toHaveBeenCalledWith(defaultProps.editorJson);
    });
  });

  it("calls onTagsSuggested with merged tags on success", async () => {
    mockSuggestTags.mockResolvedValue({
      success: true,
      tags: ["sunset", "beach"],
    });

    render(<AutoTagButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("auto-tag-button"));

    await waitFor(() => {
      expect(defaultProps.onTagsSuggested).toHaveBeenCalledWith([
        "sunset",
        "beach",
      ]);
    });
  });

  it("merges with existing tags without duplicates", async () => {
    mockSuggestTags.mockResolvedValue({
      success: true,
      tags: ["sunset", "beach", "nature"],
    });

    const onTagsSuggested = vi.fn();
    render(
      <AutoTagButton
        {...defaultProps}
        existingTags={["beach", "travel"]}
        onTagsSuggested={onTagsSuggested}
      />
    );
    fireEvent.click(screen.getByTestId("auto-tag-button"));

    await waitFor(() => {
      expect(onTagsSuggested).toHaveBeenCalledWith([
        "beach",
        "travel",
        "sunset",
        "nature",
      ]);
    });
  });

  it("shows error message on failure", async () => {
    mockSuggestTags.mockResolvedValue({
      success: false,
      tags: [],
      error: "No content to analyze",
    });

    render(<AutoTagButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("auto-tag-button"));

    await waitFor(() => {
      expect(screen.getByTestId("auto-tag-error")).toHaveTextContent(
        "No content to analyze"
      );
    });
  });

  it("shows error on exception", async () => {
    mockSuggestTags.mockRejectedValue(new Error("Network error"));

    render(<AutoTagButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("auto-tag-button"));

    await waitFor(() => {
      expect(screen.getByTestId("auto-tag-error")).toHaveTextContent(
        "Failed to suggest tags"
      );
    });
  });

  it("re-enables button after completion", async () => {
    mockSuggestTags.mockResolvedValue({
      success: true,
      tags: ["tag1"],
    });

    render(<AutoTagButton {...defaultProps} />);
    const button = screen.getByTestId("auto-tag-button");

    fireEvent.click(button);

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it("clears error on subsequent successful click", async () => {
    mockSuggestTags.mockResolvedValueOnce({
      success: false,
      tags: [],
      error: "Failed",
    });

    render(<AutoTagButton {...defaultProps} />);
    fireEvent.click(screen.getByTestId("auto-tag-button"));

    await waitFor(() => {
      expect(screen.getByTestId("auto-tag-error")).toBeInTheDocument();
    });

    mockSuggestTags.mockResolvedValueOnce({
      success: true,
      tags: ["tag1"],
    });

    fireEvent.click(screen.getByTestId("auto-tag-button"));

    await waitFor(() => {
      expect(screen.queryByTestId("auto-tag-error")).not.toBeInTheDocument();
    });
  });
});
