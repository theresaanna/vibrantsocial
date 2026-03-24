import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

// ---- PostComposer mocks (same as post-composer-link-preview test) ----

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

vi.mock("@lexical/react/LexicalListPlugin", () => ({ ListPlugin: () => null }));
vi.mock("@lexical/react/LexicalCheckListPlugin", () => ({ CheckListPlugin: () => null }));
vi.mock("@lexical/react/LexicalLinkPlugin", () => ({ LinkPlugin: () => null }));
vi.mock("@lexical/react/LexicalHorizontalRulePlugin", () => ({ HorizontalRulePlugin: () => null }));
vi.mock("@lexical/react/LexicalTablePlugin", () => ({ TablePlugin: () => null }));
vi.mock("@lexical/react/LexicalTabIndentationPlugin", () => ({ TabIndentationPlugin: () => null }));

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: vi.fn().mockReturnValue([{ update: vi.fn() }]),
}));

vi.mock("lexical", () => ({
  $getRoot: vi.fn().mockReturnValue({ clear: vi.fn() }),
}));

vi.mock("@/components/editor/theme", () => ({ editorTheme: {} }));
vi.mock("@/components/editor/nodes", () => ({ editorNodes: [] }));
vi.mock("@/components/editor/toolbar/Toolbar", () => ({
  Toolbar: () => <div data-testid="toolbar" />,
}));
vi.mock("@/components/editor/plugins/AutoLinkPlugin", () => ({ AutoLinkPlugin: () => null }));
vi.mock("@/components/editor/plugins/MentionsPlugin", () => ({ MentionsPlugin: () => null }));
vi.mock("@/components/editor/plugins/HashtagPlugin", () => ({ HashtagPlugin: () => null }));
vi.mock("@/components/editor/plugins/HashtagLinkPlugin", () => ({ HashtagLinkPlugin: () => null }));
vi.mock("@/components/editor/plugins/DraftPlugin", () => ({
  DraftPlugin: () => null,
  ClearDraftButton: () => null,
  clearDraft: vi.fn(),
}));
vi.mock("@/components/tag-input", () => ({ TagInput: () => <div data-testid="tag-input" /> }));
vi.mock("@/components/auto-tag-button", () => ({ AutoTagButton: () => <div /> }));
vi.mock("@/components/content-flags-info-modal", () => ({ ContentFlagsInfoModal: () => null }));
vi.mock("@/components/audience-picker", () => ({ AudiencePicker: () => null }));
vi.mock("@/components/premium-crown", () => ({ PremiumCrown: () => null }));
vi.mock("@/app/feed/actions", () => ({ createPost: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/link-preview-card", () => ({
  LinkPreviewCard: ({ url, onLoadChange }: { url: string; onLoadChange?: (status: string) => void }) => {
    if (onLoadChange) setTimeout(() => onLoadChange("loaded"), 0);
    return <div data-testid="link-preview-card">{url}</div>;
  },
}));

const mockExtractFirstUrl = vi.fn();
vi.mock("@/lib/lexical-text", () => ({
  extractFirstUrl: (...args: unknown[]) => mockExtractFirstUrl(...args),
}));

// ---- PostContent mocks ----

vi.mock("@/components/editor/EditorContent", () => ({
  EditorContent: () => <div data-testid="editor-content" />,
}));

import { PostComposer } from "@/components/post-composer";
import { PostContent } from "@/components/post-content";

describe("hideLinkPreview - PostComposer form field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    onChangeCallback = null;
    mockExtractFirstUrl.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets hideLinkPreview to false by default", () => {
    render(<PostComposer phoneVerified={true} isOldEnough={true} />);

    const input = document.querySelector('input[name="hideLinkPreview"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("false");
  });

  it("sets hideLinkPreview to true when preview is dismissed", () => {
    mockExtractFirstUrl.mockReturnValue("https://example.com");

    render(<PostComposer phoneVerified={true} isOldEnough={true} />);

    // Trigger URL detection
    act(() => {
      onChangeCallback?.({ toJSON: () => ({ some: "data" }) });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Wait for onLoadChange
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Dismiss the preview
    fireEvent.click(screen.getByTestId("dismiss-link-preview"));

    const input = document.querySelector('input[name="hideLinkPreview"]') as HTMLInputElement;
    expect(input.value).toBe("true");
  });

  it("resets hideLinkPreview to false when URL changes", () => {
    mockExtractFirstUrl.mockReturnValue("https://example.com");

    render(<PostComposer phoneVerified={true} isOldEnough={true} />);

    // Trigger first URL
    act(() => {
      onChangeCallback?.({ toJSON: () => ({ some: "data" }) });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Dismiss
    fireEvent.click(screen.getByTestId("dismiss-link-preview"));

    const input = document.querySelector('input[name="hideLinkPreview"]') as HTMLInputElement;
    expect(input.value).toBe("true");

    // Change to a different URL
    mockExtractFirstUrl.mockReturnValue("https://other.com");
    act(() => {
      onChangeCallback?.({ toJSON: () => ({ different: "content" }) });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // hideLinkPreview should reset to false with new URL
    expect(input.value).toBe("false");
  });
});

describe("hideLinkPreview - PostContent display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const contentWithUrl = JSON.stringify({
    root: {
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "link",
              url: "https://example.com",
              children: [{ type: "text", text: "Example" }],
            },
          ],
        },
      ],
    },
  });

  it("shows link preview when hideLinkPreview is false", () => {
    mockExtractFirstUrl.mockReturnValue("https://example.com");

    render(<PostContent content={contentWithUrl} hideLinkPreview={false} />);

    expect(screen.getByTestId("link-preview-card")).toBeInTheDocument();
  });

  it("hides link preview when hideLinkPreview is true", () => {
    mockExtractFirstUrl.mockReturnValue("https://example.com");

    render(<PostContent content={contentWithUrl} hideLinkPreview={true} />);

    expect(screen.queryByTestId("link-preview-card")).not.toBeInTheDocument();
  });

  it("shows link preview by default (hideLinkPreview undefined)", () => {
    mockExtractFirstUrl.mockReturnValue("https://example.com");

    render(<PostContent content={contentWithUrl} />);

    expect(screen.getByTestId("link-preview-card")).toBeInTheDocument();
  });

  it("does not show link preview when no URL is in content", () => {
    mockExtractFirstUrl.mockReturnValue(null);

    render(<PostContent content="{}" hideLinkPreview={false} />);

    expect(screen.queryByTestId("link-preview-card")).not.toBeInTheDocument();
  });
});
