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

vi.mock("@/components/audience-picker", () => ({
  AudiencePicker: ({
    isOpen,
    onClose,
    onSelectionChange,
  }: {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
  }) =>
    isOpen ? (
      <div data-testid="audience-picker-modal">
        <button
          data-testid="mock-select-friends"
          onClick={() => onSelectionChange(["user-1", "user-2"])}
        >
          Select Friends
        </button>
        <button data-testid="mock-close-picker" onClick={onClose}>
          Done
        </button>
      </div>
    ) : null,
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

describe("PostComposer - Custom Audience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show Custom Audience button when isPremium is false", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={false} />
    );
    expect(screen.queryByTestId("custom-audience-button")).not.toBeInTheDocument();
  });

  it("does not show Custom Audience button when isPremium is not provided", () => {
    render(<PostComposer phoneVerified={true} isOldEnough={true} />);
    expect(screen.queryByTestId("custom-audience-button")).not.toBeInTheDocument();
  });

  it("shows Custom Audience button when isPremium is true", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );
    expect(screen.getByTestId("custom-audience-button")).toBeInTheDocument();
    expect(screen.getByText("Custom Audience")).toBeInTheDocument();
  });

  it("opens audience picker when Custom Audience button is clicked", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );
    fireEvent.click(screen.getByTestId("custom-audience-button"));
    expect(screen.getByTestId("audience-picker-modal")).toBeInTheDocument();
  });

  it("renders hidden inputs for hasCustomAudience and customAudienceIds", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );
    const hasCustomAudience = document.querySelector(
      'input[name="hasCustomAudience"]'
    ) as HTMLInputElement;
    const customAudienceIds = document.querySelector(
      'input[name="customAudienceIds"]'
    ) as HTMLInputElement;

    expect(hasCustomAudience).toBeInTheDocument();
    expect(hasCustomAudience.value).toBe("false");
    expect(customAudienceIds).toBeInTheDocument();
    expect(customAudienceIds.value).toBe("");
  });

  it("updates hidden inputs when friends are selected in picker", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    // Open picker
    fireEvent.click(screen.getByTestId("custom-audience-button"));

    // Select friends via mock
    fireEvent.click(screen.getByTestId("mock-select-friends"));

    const hasCustomAudience = document.querySelector(
      'input[name="hasCustomAudience"]'
    ) as HTMLInputElement;
    const customAudienceIds = document.querySelector(
      'input[name="customAudienceIds"]'
    ) as HTMLInputElement;

    expect(hasCustomAudience.value).toBe("true");
    expect(customAudienceIds.value).toBe("user-1,user-2");
  });

  it("shows count in button text when audience is selected", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    // Open picker and select friends
    fireEvent.click(screen.getByTestId("custom-audience-button"));
    fireEvent.click(screen.getByTestId("mock-select-friends"));
    fireEvent.click(screen.getByTestId("mock-close-picker"));

    expect(screen.getByText("Custom Audience (2)")).toBeInTheDocument();
  });

  it("reopens picker when Custom Audience button is clicked while active", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    // Open picker and select friends
    fireEvent.click(screen.getByTestId("custom-audience-button"));
    fireEvent.click(screen.getByTestId("mock-select-friends"));
    fireEvent.click(screen.getByTestId("mock-close-picker"));

    // Click button again — should reopen picker, not clear
    fireEvent.click(screen.getByTestId("custom-audience-button"));

    expect(screen.getByTestId("audience-picker-modal")).toBeInTheDocument();

    // Audience should still be set
    const hasCustomAudience = document.querySelector(
      'input[name="hasCustomAudience"]'
    ) as HTMLInputElement;
    expect(hasCustomAudience.value).toBe("true");
  });

  it("clears audience when × clear button is clicked", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    // Open picker and select friends
    fireEvent.click(screen.getByTestId("custom-audience-button"));
    fireEvent.click(screen.getByTestId("mock-select-friends"));
    fireEvent.click(screen.getByTestId("mock-close-picker"));

    // Verify audience is active
    expect(screen.getByText("Custom Audience (2)")).toBeInTheDocument();

    // Click the × clear button
    fireEvent.click(screen.getByTestId("clear-custom-audience"));

    const hasCustomAudience = document.querySelector(
      'input[name="hasCustomAudience"]'
    ) as HTMLInputElement;
    expect(hasCustomAudience.value).toBe("false");
  });

  it("shows × clear button only when audience is selected", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    // No clear button initially
    expect(screen.queryByTestId("clear-custom-audience")).not.toBeInTheDocument();

    // Open picker and select friends
    fireEvent.click(screen.getByTestId("custom-audience-button"));
    fireEvent.click(screen.getByTestId("mock-select-friends"));
    fireEvent.click(screen.getByTestId("mock-close-picker"));

    // Clear button should now appear
    expect(screen.getByTestId("clear-custom-audience")).toBeInTheDocument();
  });

  it("disables Close Friends when Custom Audience is selected", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    // Enable Close Friends first
    const closeFriendsLabel = screen.getByText("Close Friends");
    const closeFriendsCheckbox = closeFriendsLabel
      .closest("label")
      ?.querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(closeFriendsCheckbox);
    expect(closeFriendsCheckbox.checked).toBe(true);

    // Open audience picker (should disable close friends)
    fireEvent.click(screen.getByTestId("custom-audience-button"));
    expect(closeFriendsCheckbox.checked).toBe(false);
  });

  it("clears Custom Audience when Close Friends is enabled", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    // Select custom audience
    fireEvent.click(screen.getByTestId("custom-audience-button"));
    fireEvent.click(screen.getByTestId("mock-select-friends"));
    fireEvent.click(screen.getByTestId("mock-close-picker"));

    // Enable Close Friends
    const closeFriendsLabel = screen.getByText(/Close Friends/);
    const closeFriendsCheckbox = closeFriendsLabel
      .closest("label")
      ?.querySelector("input[type='checkbox']") as HTMLInputElement;
    fireEvent.click(closeFriendsCheckbox);

    const hasCustomAudience = document.querySelector(
      'input[name="hasCustomAudience"]'
    ) as HTMLInputElement;
    expect(hasCustomAudience.value).toBe("false");
  });
});
