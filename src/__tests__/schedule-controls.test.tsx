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
    { update: vi.fn() },
  ]),
}));

vi.mock("lexical", () => ({
  $getRoot: vi.fn().mockReturnValue({ clear: vi.fn() }),
}));

vi.mock("@/components/editor/theme", () => ({ editorTheme: {} }));
vi.mock("@/components/editor/nodes", () => ({ editorNodes: [] }));
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
vi.mock("@/components/link-preview-card", () => ({
  LinkPreviewCard: () => null,
}));
vi.mock("@/lib/lexical-text", () => ({
  extractFirstUrl: vi.fn().mockReturnValue(null),
}));
vi.mock("@/app/feed/actions", () => ({
  createPost: vi.fn(),
}));

vi.mock("@/components/premium-crown", () => ({
  PremiumCrown: ({ href }: { href?: string }) => (
    <a href={href}><span title="Premium feature">+</span></a>
  ),
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

describe("PostComposer scheduling controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Schedule toggle for all users", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} />
    );
    expect(screen.getByTestId("schedule-toggle")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  it("disables schedule toggle for non-premium users", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={false} />
    );
    const toggle = screen.getByTestId("schedule-toggle");
    expect(toggle).toBeDisabled();
  });

  it("shows premium badge near schedule section for all users", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={false} />
    );
    // Both Custom Audience and Schedule sections show premium badges
    const premiumLinks = screen.getAllByTitle("Premium feature");
    expect(premiumLinks.length).toBeGreaterThanOrEqual(2);
    // All should link to /premium
    premiumLinks.forEach((link) => {
      expect(link.closest("a")).toHaveAttribute("href", "/premium");
    });
  });

  it("enables schedule toggle for premium users", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );
    const toggle = screen.getByTestId("schedule-toggle");
    expect(toggle).not.toBeDisabled();
  });

  it("shows datetime picker when premium user clicks toggle", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    expect(screen.queryByTestId("schedule-datetime")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("schedule-toggle"));

    expect(screen.getByTestId("schedule-datetime")).toBeInTheDocument();
  });

  it("does not show datetime picker when non-premium user clicks toggle", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={false} />
    );

    fireEvent.click(screen.getByTestId("schedule-toggle"));

    expect(screen.queryByTestId("schedule-datetime")).not.toBeInTheDocument();
  });

  it("shows Schedule button text when a date is selected", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    // Open the schedule section
    fireEvent.click(screen.getByTestId("schedule-toggle"));

    // Set a future date
    const datetimeInput = screen.getByTestId("schedule-datetime");
    fireEvent.change(datetimeInput, { target: { value: "2099-01-01T12:00" } });

    expect(screen.getByText("Schedule")).toBeInTheDocument();
  });

  it("shows clear button when schedule is set", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    fireEvent.click(screen.getByTestId("schedule-toggle"));
    const datetimeInput = screen.getByTestId("schedule-datetime");
    fireEvent.change(datetimeInput, { target: { value: "2099-01-01T12:00" } });

    expect(screen.getByTestId("clear-schedule")).toBeInTheDocument();
  });

  it("clears schedule when clear button is clicked", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );

    fireEvent.click(screen.getByTestId("schedule-toggle"));
    const datetimeInput = screen.getByTestId("schedule-datetime");
    fireEvent.change(datetimeInput, { target: { value: "2099-01-01T12:00" } });
    fireEvent.click(screen.getByTestId("clear-schedule"));

    // Should revert to "Post" button
    expect(screen.getByText("Post")).toBeInTheDocument();
    expect(screen.queryByTestId("clear-schedule")).not.toBeInTheDocument();
  });

  it("shows Post button by default (no schedule)", () => {
    render(
      <PostComposer phoneVerified={true} isOldEnough={true} isPremium={true} />
    );
    expect(screen.getByText("Post")).toBeInTheDocument();
  });
});
