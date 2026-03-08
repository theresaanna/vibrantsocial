import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuotePostModal } from "@/components/quote-post-modal";

let mockCreateQuoteRepost: ReturnType<typeof vi.fn>;

vi.mock("@/app/feed/post-actions", () => ({
  createQuoteRepost: (...args: unknown[]) => mockCreateQuoteRepost(...args),
}));

vi.mock("@/lib/web-push", () => ({
  sendPushNotification: vi.fn(),
}));

vi.mock("@/app/chat/actions", () => ({
  searchUsers: vi.fn().mockResolvedValue([]),
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

  it("renders Lexical editor and original post preview", () => {
    render(<QuotePostModal {...defaultProps} />);
    expect(screen.getByTestId("quote-editor")).toBeInTheDocument();
    expect(screen.getByText("@bob")).toBeInTheDocument();
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("submit button is disabled initially (no content)", () => {
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

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<QuotePostModal {...defaultProps} onClose={onClose} />);
    // Click the backdrop (outermost overlay div)
    const backdrop = container.firstChild as HTMLElement;
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders Quote Post heading", () => {
    render(<QuotePostModal {...defaultProps} />);
    const heading = screen.getByRole("heading", { name: "Quote Post" });
    expect(heading).toBeInTheDocument();
  });

  it("parses Lexical JSON for original content preview", () => {
    const lexicalContent = JSON.stringify({
      root: {
        children: [
          {
            children: [{ text: "Rich text content" }],
          },
        ],
      },
    });
    render(<QuotePostModal {...defaultProps} originalContent={lexicalContent} />);
    expect(screen.getByText("Rich text content")).toBeInTheDocument();
  });

  it("truncates long original content in preview", () => {
    const longContent = "A".repeat(300);
    render(<QuotePostModal {...defaultProps} originalContent={longContent} />);
    expect(screen.getByText(/A{200}\.\.\./)).toBeInTheDocument();
  });
});
