import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock Lexical and editor dependencies
vi.mock("@lexical/react/LexicalComposer", () => ({
  LexicalComposer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="lexical-composer">{children}</div>
  ),
}));
vi.mock("@lexical/react/LexicalRichTextPlugin", () => ({
  RichTextPlugin: () => <div data-testid="rich-text-plugin" />,
}));
vi.mock("@lexical/react/LexicalContentEditable", () => ({
  ContentEditable: () => <div data-testid="content-editable" />,
}));
vi.mock("@lexical/react/LexicalHistoryPlugin", () => ({
  HistoryPlugin: () => null,
}));
vi.mock("@lexical/react/LexicalOnChangePlugin", () => ({
  OnChangePlugin: () => null,
}));
vi.mock("@lexical/react/LexicalListPlugin", () => ({
  ListPlugin: () => null,
}));
vi.mock("@lexical/react/LexicalCheckListPlugin", () => ({
  CheckListPlugin: () => null,
}));
vi.mock("@lexical/react/LexicalLinkPlugin", () => ({
  LinkPlugin: () => null,
}));
vi.mock("@lexical/react/LexicalHorizontalRulePlugin", () => ({
  HorizontalRulePlugin: () => null,
}));
vi.mock("@lexical/react/LexicalTablePlugin", () => ({
  TablePlugin: () => null,
}));
vi.mock("@lexical/react/LexicalTabIndentationPlugin", () => ({
  TabIndentationPlugin: () => null,
}));

vi.mock("@/components/editor/theme", () => ({
  editorTheme: {},
}));
vi.mock("@/components/editor/nodes", () => ({
  editorNodes: [],
}));
vi.mock("@/components/editor/toolbar/Toolbar", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));
vi.mock("@/components/editor/plugins/AutoLinkPlugin", () => ({
  AutoLinkPlugin: () => null,
}));
vi.mock("@/components/editor/plugins/MentionsPlugin", () => ({
  MentionsPlugin: () => null,
}));
vi.mock("@/components/tag-input", () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));
vi.mock("@/components/auto-tag-button", () => ({
  AutoTagButton: () => <button data-testid="auto-tag-button">Auto Tag</button>,
}));
vi.mock("@/components/content-flags-info-modal", () => ({
  ContentFlagsInfoModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="content-flags-info-modal">
      <button onClick={onClose}>Close modal</button>
    </div>
  ),
}));
vi.mock("@/components/post-content", () => ({
  PostContent: ({ content }: { content: string }) => (
    <div data-testid="post-content">{content}</div>
  ),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: vi.fn().mockReturnValue("5m ago"),
}));

const mockCreateQuoteRepost = vi.fn();

vi.mock("@/app/feed/post-actions", () => ({
  createQuoteRepost: (...args: unknown[]) => mockCreateQuoteRepost(...args),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { QuotePostPage } from "@/app/post/[id]/quote/quote-post-page";

const defaultProps = {
  postId: "post-123",
  originalAuthor: "alice",
  originalAuthorDisplayName: "Alice Smith",
  originalAuthorAvatar: null as string | null,
  originalContent: '{"root":{"children":[]}}',
  originalCreatedAt: new Date().toISOString(),
};

describe("QuotePostPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Rendering ──────────────────────────────────────────────

  it("renders Quote Post heading", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(
      screen.getByRole("heading", { name: "Quote Post" })
    ).toBeInTheDocument();
  });

  it("renders Back to post link", () => {
    render(<QuotePostPage {...defaultProps} />);
    const link = screen.getByText("Back to post");
    expect(link.closest("a")).toHaveAttribute("href", "/post/post-123");
  });

  it("renders the editor area", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByTestId("quote-editor")).toBeInTheDocument();
  });

  it("renders the toolbar", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
  });

  it("renders tag input", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByTestId("tag-input")).toBeInTheDocument();
  });

  it("renders auto tag button", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByTestId("auto-tag-button")).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByTestId("quote-submit")).toBeInTheDocument();
    expect(screen.getByTestId("quote-submit")).toHaveTextContent("Quote Post");
  });

  it("renders the cancel link", () => {
    render(<QuotePostPage {...defaultProps} />);
    const cancelLink = screen.getByRole("link", { name: /cancel/i });
    expect(cancelLink).toHaveAttribute("href", "/post/post-123");
  });

  it("submit button is disabled initially (no content)", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByTestId("quote-submit")).toBeDisabled();
  });

  // ─── Original post preview ─────────────────────────────────

  it("renders original author display name", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("renders original author username", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByText("@alice")).toBeInTheDocument();
  });

  it("renders time ago for original post", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });

  it("renders original post content", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByTestId("post-content")).toBeInTheDocument();
  });

  it("shows author initial when no avatar", () => {
    render(<QuotePostPage {...defaultProps} originalAuthorAvatar={null} />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows author avatar when provided", () => {
    const { container } = render(
      <QuotePostPage
        {...defaultProps}
        originalAuthorAvatar="https://example.com/avatar.jpg"
      />
    );
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  // ─── Content warnings ──────────────────────────────────────

  it("shows content warnings section when toggled", async () => {
    const user = userEvent.setup();
    render(<QuotePostPage {...defaultProps} />);

    await user.click(screen.getByText("Content Warnings"));

    expect(screen.getByLabelText("NSFW")).toBeInTheDocument();
    expect(screen.getByLabelText("Sensitive")).toBeInTheDocument();
    expect(screen.getByLabelText("Graphic/Explicit")).toBeInTheDocument();
  });

  it("hides content warnings by default", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.queryByLabelText("NSFW")).not.toBeInTheDocument();
  });

  it("toggles NSFW checkbox", async () => {
    const user = userEvent.setup();
    render(<QuotePostPage {...defaultProps} />);

    await user.click(screen.getByText("Content Warnings"));
    const nsfw = screen.getByLabelText("NSFW");
    expect(nsfw).not.toBeChecked();

    await user.click(nsfw);
    expect(nsfw).toBeChecked();
  });

  it("toggles Sensitive checkbox", async () => {
    const user = userEvent.setup();
    render(<QuotePostPage {...defaultProps} />);

    await user.click(screen.getByText("Content Warnings"));
    const sensitive = screen.getByLabelText("Sensitive");

    await user.click(sensitive);
    expect(sensitive).toBeChecked();
  });

  it("toggles Graphic/Explicit checkbox", async () => {
    const user = userEvent.setup();
    render(<QuotePostPage {...defaultProps} />);

    await user.click(screen.getByText("Content Warnings"));
    const graphic = screen.getByLabelText("Graphic/Explicit");

    await user.click(graphic);
    expect(graphic).toBeChecked();
  });

  // ─── Close Friends toggle ──────────────────────────────────

  it("renders Close Friends toggle", () => {
    render(<QuotePostPage {...defaultProps} />);
    expect(screen.getByText("Close Friends")).toBeInTheDocument();
  });

  it("Close Friends is unchecked by default", () => {
    render(<QuotePostPage {...defaultProps} />);
    const checkbox = screen.getByTitle("Only visible to your close friends")
      .querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  // ─── Content flags info modal ──────────────────────────────

  it("shows content flags info modal when info button is clicked", async () => {
    const user = userEvent.setup();
    render(<QuotePostPage {...defaultProps} />);

    await user.click(screen.getByText("Content Warnings"));
    await user.click(screen.getByTitle("Content flag guidelines"));

    expect(
      screen.getByTestId("content-flags-info-modal")
    ).toBeInTheDocument();
  });

  it("hides content flags info modal when closed", async () => {
    const user = userEvent.setup();
    render(<QuotePostPage {...defaultProps} />);

    await user.click(screen.getByText("Content Warnings"));
    await user.click(screen.getByTitle("Content flag guidelines"));
    expect(
      screen.getByTestId("content-flags-info-modal")
    ).toBeInTheDocument();

    await user.click(screen.getByText("Close modal"));
    expect(
      screen.queryByTestId("content-flags-info-modal")
    ).not.toBeInTheDocument();
  });
});
