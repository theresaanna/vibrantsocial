import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketplaceQA } from "@/components/marketplace-qa";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ alt }: { alt: string }) => <span data-testid="avatar">{alt}</span>,
}));

const mockGetQuestions = vi.fn();
const mockAskQuestion = vi.fn();
const mockAnswerQuestion = vi.fn();
const mockDeleteQuestion = vi.fn();

vi.mock("@/app/marketplace/qa-actions", () => ({
  getQuestions: (...args: unknown[]) => mockGetQuestions(...args),
  askQuestion: (...args: unknown[]) => mockAskQuestion(...args),
  answerQuestion: (...args: unknown[]) => mockAnswerQuestion(...args),
  deleteQuestion: (...args: unknown[]) => mockDeleteQuestion(...args),
}));

describe("MarketplaceQA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetQuestions.mockResolvedValue([]);
  });

  it("renders Q&A section with data-testid", async () => {
    render(
      <MarketplaceQA
        marketplacePostId="mp-1"
        postAuthorId="author-1"
        currentUserId="user-1"
      />
    );
    expect(screen.getByTestId("marketplace-qa")).toBeInTheDocument();
  });

  it("renders Q&A heading", async () => {
    render(
      <MarketplaceQA
        marketplacePostId="mp-1"
        postAuthorId="author-1"
        currentUserId="user-1"
      />
    );
    expect(screen.getByText("Q&A")).toBeInTheDocument();
  });

  it("shows ask input for non-authors", () => {
    render(
      <MarketplaceQA
        marketplacePostId="mp-1"
        postAuthorId="author-1"
        currentUserId="user-2"
      />
    );
    expect(screen.getByTestId("marketplace-qa-input")).toBeInTheDocument();
    expect(screen.getByTestId("marketplace-qa-submit")).toBeInTheDocument();
  });

  it("does not show ask input for the post author", () => {
    render(
      <MarketplaceQA
        marketplacePostId="mp-1"
        postAuthorId="author-1"
        currentUserId="author-1"
      />
    );
    expect(screen.queryByTestId("marketplace-qa-input")).not.toBeInTheDocument();
  });

  it("does not show ask input for unauthenticated users", () => {
    render(
      <MarketplaceQA
        marketplacePostId="mp-1"
        postAuthorId="author-1"
      />
    );
    expect(screen.queryByTestId("marketplace-qa-input")).not.toBeInTheDocument();
  });

  it("renders questions when loaded", async () => {
    mockGetQuestions.mockResolvedValue([
      {
        id: "q-1",
        question: "Is this still available?",
        answer: "Yes it is!",
        answeredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        asker: {
          id: "user-2",
          username: "buyer",
          displayName: "Buyer",
          avatar: null,
          image: null,
          profileFrameId: null,
        },
      },
    ]);

    render(
      <MarketplaceQA
        marketplacePostId="mp-1"
        postAuthorId="author-1"
        currentUserId="user-3"
      />
    );

    // Wait for the questions to load
    expect(await screen.findByText("Is this still available?")).toBeInTheDocument();
    expect(screen.getByText("Yes it is!")).toBeInTheDocument();
    expect(screen.getByText("Seller")).toBeInTheDocument();
  });

  it("shows question count in header", async () => {
    mockGetQuestions.mockResolvedValue([
      {
        id: "q-1",
        question: "Test question",
        answer: null,
        answeredAt: null,
        createdAt: new Date().toISOString(),
        asker: {
          id: "user-2",
          username: "buyer",
          displayName: "Buyer",
          avatar: null,
          image: null,
          profileFrameId: null,
        },
      },
    ]);

    render(
      <MarketplaceQA
        marketplacePostId="mp-1"
        postAuthorId="author-1"
        currentUserId="user-3"
      />
    );

    expect(await screen.findByText("(1)")).toBeInTheDocument();
  });

  it("shows 'Answer this question' button for post author on unanswered questions", async () => {
    mockGetQuestions.mockResolvedValue([
      {
        id: "q-1",
        question: "Is this new?",
        answer: null,
        answeredAt: null,
        createdAt: new Date().toISOString(),
        asker: {
          id: "user-2",
          username: "buyer",
          displayName: "Buyer",
          avatar: null,
          image: null,
          profileFrameId: null,
        },
      },
    ]);

    render(
      <MarketplaceQA
        marketplacePostId="mp-1"
        postAuthorId="author-1"
        currentUserId="author-1"
      />
    );

    expect(await screen.findByTestId("marketplace-qa-reply-button")).toBeInTheDocument();
  });

  it("calls askQuestion when submitting a question", async () => {
    mockAskQuestion.mockResolvedValue({ success: true, message: "Question submitted" });
    mockGetQuestions.mockResolvedValue([]);

    render(
      <MarketplaceQA
        marketplacePostId="mp-1"
        postAuthorId="author-1"
        currentUserId="user-2"
      />
    );

    const input = screen.getByTestId("marketplace-qa-input");
    await userEvent.type(input, "Is shipping fast?");
    await userEvent.click(screen.getByTestId("marketplace-qa-submit"));

    expect(mockAskQuestion).toHaveBeenCalledWith("mp-1", "Is shipping fast?");
  });

  it("shows empty state text when no questions", async () => {
    mockGetQuestions.mockResolvedValue([]);

    render(
      <MarketplaceQA
        marketplacePostId="mp-1"
        postAuthorId="author-1"
        currentUserId="user-2"
      />
    );

    expect(await screen.findByText(/No questions yet/)).toBeInTheDocument();
  });
});
