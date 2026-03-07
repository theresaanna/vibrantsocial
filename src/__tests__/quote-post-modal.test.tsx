import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuotePostModal } from "@/components/quote-post-modal";

let mockCreateQuoteRepost: ReturnType<typeof vi.fn>;

vi.mock("@/app/feed/post-actions", () => ({
  createQuoteRepost: (...args: unknown[]) => mockCreateQuoteRepost(...args),
}));

const defaultProps = {
  postId: "p1",
  originalAuthor: "bob",
  originalContent: "Hello world",
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

describe("QuotePostModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateQuoteRepost = vi.fn().mockResolvedValue({ success: true, message: "Quote posted" });
  });

  it("renders textarea and original post preview", () => {
    render(<QuotePostModal {...defaultProps} />);
    expect(screen.getByTestId("quote-textarea")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("shows character count", () => {
    render(<QuotePostModal {...defaultProps} />);
    expect(screen.getByText("0/500")).toBeInTheDocument();
  });

  it("updates character count as user types", async () => {
    const user = userEvent.setup();
    render(<QuotePostModal {...defaultProps} />);
    await user.type(screen.getByTestId("quote-textarea"), "test");
    expect(screen.getByText("4/500")).toBeInTheDocument();
  });

  it("submit button is disabled when textarea is empty", () => {
    render(<QuotePostModal {...defaultProps} />);
    const submitBtn = screen.getByTestId("quote-submit");
    expect(submitBtn).toBeDisabled();
  });

  it("calls onClose when Cancel is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<QuotePostModal {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls createQuoteRepost on submit", async () => {
    const user = userEvent.setup();
    render(<QuotePostModal {...defaultProps} />);

    await user.type(screen.getByTestId("quote-textarea"), "My thoughts on this");
    await user.click(screen.getByTestId("quote-submit"));

    expect(mockCreateQuoteRepost).toHaveBeenCalledTimes(1);
    const [, formData] = mockCreateQuoteRepost.mock.calls[0];
    expect(formData.get("postId")).toBe("p1");
    expect(formData.get("content")).toBe("My thoughts on this");
  });

  it("calls onSuccess and onClose on successful submission", async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<QuotePostModal {...defaultProps} onClose={onClose} onSuccess={onSuccess} />);

    await user.type(screen.getByTestId("quote-textarea"), "Great post");
    await user.click(screen.getByTestId("quote-submit"));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows error message on failure", async () => {
    mockCreateQuoteRepost = vi.fn().mockResolvedValue({
      success: false,
      message: "You have already reposted this post",
    });
    const user = userEvent.setup();
    render(<QuotePostModal {...defaultProps} />);

    await user.type(screen.getByTestId("quote-textarea"), "Test");
    await user.click(screen.getByTestId("quote-submit"));

    expect(screen.getByText("You have already reposted this post")).toBeInTheDocument();
  });
});
