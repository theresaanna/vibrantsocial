import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

vi.mock("@lexical/react/LexicalComposer", () => ({
  LexicalComposer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="lexical-composer">{children}</div>
  ),
}));

vi.mock("@lexical/react/LexicalRichTextPlugin", () => ({
  RichTextPlugin: ({
    contentEditable,
    placeholder,
  }: {
    contentEditable: React.ReactNode;
    placeholder: React.ReactNode;
  }) => (
    <div data-testid="rich-text-plugin">
      {contentEditable}
      {placeholder}
    </div>
  ),
}));

vi.mock("@lexical/react/LexicalContentEditable", () => ({
  ContentEditable: (props: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="content-editable" {...props} />
  ),
}));

vi.mock("@lexical/react/LexicalHistoryPlugin", () => ({
  HistoryPlugin: () => null,
}));

let onChangeCallback: ((state: unknown) => void) | null = null;
vi.mock("@lexical/react/LexicalOnChangePlugin", () => ({
  OnChangePlugin: ({ onChange }: { onChange: (state: unknown) => void }) => {
    onChangeCallback = onChange;
    return null;
  },
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

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: vi.fn().mockReturnValue([
    { update: vi.fn() },
  ]),
}));

vi.mock("lexical", () => ({
  $getRoot: vi.fn().mockReturnValue({ clear: vi.fn() }),
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

vi.mock("@/components/editor/plugins/HashtagPlugin", () => ({
  HashtagPlugin: () => null,
}));

vi.mock("@/components/editor/plugins/HashtagLinkPlugin", () => ({
  HashtagLinkPlugin: () => null,
}));

vi.mock("@/components/editor/plugins/DraftPlugin", () => ({
  DraftPlugin: () => null,
  ClearDraftButton: () => null,
  clearDraft: vi.fn(),
}));

vi.mock("@/components/tag-input", () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));

vi.mock("@/components/auto-tag-button", () => ({
  AutoTagButton: () => <div data-testid="auto-tag-button" />,
}));

vi.mock("@/components/content-flags-info-modal", () => ({
  ContentFlagsInfoModal: () => null,
}));

vi.mock("@/components/audience-picker", () => ({
  AudiencePicker: () => null,
}));

vi.mock("@/components/premium-crown", () => ({
  PremiumCrown: () => null,
}));

vi.mock("@/app/feed/actions", () => ({
  createPost: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock LinkPreviewCard to render a visible element
vi.mock("@/components/link-preview-card", () => ({
  LinkPreviewCard: ({ url }: { url: string }) => (
    <div data-testid="link-preview-card">{url}</div>
  ),
}));

// Mock extractFirstUrl to return a URL we control
const mockExtractFirstUrl = vi.fn();
vi.mock("@/lib/lexical-text", () => ({
  extractFirstUrl: (...args: unknown[]) => mockExtractFirstUrl(...args),
}));

import { PostComposer } from "@/components/post-composer";

describe("PostComposer - link preview dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    onChangeCallback = null;
    mockExtractFirstUrl.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows link preview when URL is detected", async () => {
    mockExtractFirstUrl.mockReturnValue("https://example.com");

    render(<PostComposer phoneVerified={true} isOldEnough={true} />);

    // Simulate editor change
    act(() => {
      onChangeCallback?.({ toJSON: () => ({ some: "data" }) });
    });

    // Advance debounce timer
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByTestId("link-preview-card")).toBeInTheDocument();
    expect(screen.getByTestId("dismiss-link-preview")).toBeInTheDocument();
  });

  it("hides link preview when dismiss button is clicked", () => {
    mockExtractFirstUrl.mockReturnValue("https://example.com");

    render(<PostComposer phoneVerified={true} isOldEnough={true} />);

    act(() => {
      onChangeCallback?.({ toJSON: () => ({ some: "data" }) });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByTestId("link-preview-card")).toBeInTheDocument();

    // Click dismiss
    fireEvent.click(screen.getByTestId("dismiss-link-preview"));

    expect(screen.queryByTestId("link-preview-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dismiss-link-preview")).not.toBeInTheDocument();
  });

  it("does not show link preview when no URL is detected", () => {
    mockExtractFirstUrl.mockReturnValue(null);

    render(<PostComposer phoneVerified={true} isOldEnough={true} />);

    expect(screen.queryByTestId("link-preview-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dismiss-link-preview")).not.toBeInTheDocument();
  });
});
