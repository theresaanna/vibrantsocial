import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostComposer } from "@/components/post-composer";

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

vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: vi.fn().mockReturnValue([
    {
      update: vi.fn(),
    },
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
  ContentFlagsInfoModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="content-flags-info-modal">
      <button onClick={onClose}>Close Modal</button>
    </div>
  ),
}));

vi.mock("@/app/feed/actions", () => ({
  createPost: vi.fn(),
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

describe("PostComposer - Logged-in Only toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Logged-in Only toggle", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    expect(screen.getByText("Logged-in Only")).toBeInTheDocument();
  });

  it("can toggle Logged-in Only", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    const label = screen.getByText("Logged-in Only");
    const checkbox = label
      .closest("label")
      ?.querySelector("input[type='checkbox']");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox!);
    expect(checkbox).toBeChecked();
  });

  it("shows info icon button next to Logged-in Only", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    const infoButton = screen.getByLabelText("Logged-in only info");
    expect(infoButton).toBeInTheDocument();
  });

  it("shows tooltip when info icon is clicked", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    const infoButton = screen.getByLabelText("Logged-in only info");
    fireEvent.click(infoButton);
    expect(
      screen.getByText(/people outside Vibrant can see your posts/)
    ).toBeInTheDocument();
  });

  it("hides tooltip when Got it is clicked", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    const infoButton = screen.getByLabelText("Logged-in only info");
    fireEvent.click(infoButton);
    expect(
      screen.getByText(/people outside Vibrant can see your posts/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Got it"));
    expect(
      screen.queryByText(/people outside Vibrant can see your posts/)
    ).not.toBeInTheDocument();
  });

  it("renders hidden input for isLoggedInOnly", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    const hiddenInput = document.querySelector(
      'input[name="isLoggedInOnly"]'
    ) as HTMLInputElement;
    expect(hiddenInput).toBeInTheDocument();
    expect(hiddenInput.type).toBe("hidden");
    expect(hiddenInput.value).toBe("false");
  });

  it("updates hidden input value when toggled", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    const label = screen.getByText("Logged-in Only");
    const checkbox = label
      .closest("label")
      ?.querySelector("input[type='checkbox']");
    fireEvent.click(checkbox!);

    const hiddenInput = document.querySelector(
      'input[name="isLoggedInOnly"]'
    ) as HTMLInputElement;
    expect(hiddenInput.value).toBe("true");
  });
});
