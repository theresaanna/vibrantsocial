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

describe("PostComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders verify phone message when not phone verified", () => {
    render(
      <PostComposer
        phoneVerified={false}
        isOldEnough={true}
      />
    );
    expect(screen.getByText("Verify your phone number")).toBeInTheDocument();
    expect(
      screen.getByText(/to start posting/)
    ).toBeInTheDocument();
  });

  it("links to verify-phone page when not verified", () => {
    render(
      <PostComposer
        phoneVerified={false}
        isOldEnough={true}
      />
    );
    const link = screen.getByText("Verify your phone number");
    expect(link).toHaveAttribute("href", "/verify-phone");
  });

  it("renders age restriction message when not old enough", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={false}
      />
    );
    expect(
      screen.getByText("You must be 18 or older to create posts.")
    ).toBeInTheDocument();
  });

  it("renders composer form when phone verified and old enough", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("tag-input")).toBeInTheDocument();
    expect(screen.getByText("Post")).toBeInTheDocument();
  });

  it("renders the Post submit button", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    const submitButton = screen.getByText("Post");
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).toHaveAttribute("type", "submit");
  });

  it("shows Content Warnings section when toggled", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    const toggleButton = screen.getByText("Content Warnings");
    fireEvent.click(toggleButton);
    expect(screen.getByText("NSFW")).toBeInTheDocument();
    expect(screen.getByText("Sensitive")).toBeInTheDocument();
    expect(screen.getByText("Graphic/Explicit")).toBeInTheDocument();
  });

  it("hides Content Warnings section when toggled back", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    const toggleButton = screen.getByText("Content Warnings");
    fireEvent.click(toggleButton);
    expect(screen.getByText("NSFW")).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.queryByText("NSFW")).not.toBeInTheDocument();
  });

  it("can check content flag checkboxes when age verified", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
        isAgeVerified={true}
      />
    );
    fireEvent.click(screen.getByText("Content Warnings"));

    const nsfwCheckbox = screen.getByRole("checkbox", { name: "NSFW" });
    fireEvent.click(nsfwCheckbox);
    expect(nsfwCheckbox).toBeChecked();

    const sensitiveCheckbox = screen.getByRole("checkbox", {
      name: "Sensitive",
    });
    fireEvent.click(sensitiveCheckbox);
    expect(sensitiveCheckbox).toBeChecked();

    const graphicCheckbox = screen.getByRole("checkbox", {
      name: "Graphic/Explicit",
    });
    fireEvent.click(graphicCheckbox);
    expect(graphicCheckbox).toBeChecked();
  });

  it("disables Sensitive and Graphic/Explicit checkboxes when not age verified", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
        isAgeVerified={false}
      />
    );
    fireEvent.click(screen.getByText("Content Warnings"));

    // NSFW should still be enabled
    const nsfwCheckbox = screen.getByRole("checkbox", { name: "NSFW" });
    expect(nsfwCheckbox).not.toBeDisabled();

    // Sensitive and Graphic/Explicit should be disabled
    const disabledCheckboxes = screen.getAllByRole("checkbox").filter((cb) => (cb as HTMLInputElement).disabled);
    expect(disabledCheckboxes).toHaveLength(2);

    // Should show verify age links
    const verifyLinks = screen.getAllByText("(verify age)");
    expect(verifyLinks).toHaveLength(2);
    expect(verifyLinks[0].closest("a")).toHaveAttribute("href", "/age-verify");
  });

  it("shows NSFW checkbox enabled regardless of age verification", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
        isAgeVerified={false}
      />
    );
    fireEvent.click(screen.getByText("Content Warnings"));

    const nsfwCheckbox = screen.getByRole("checkbox", { name: "NSFW" });
    fireEvent.click(nsfwCheckbox);
    expect(nsfwCheckbox).toBeChecked();
  });

  it("shows graphic nudity warning when Graphic/Explicit is checked", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
        isAgeVerified={true}
      />
    );
    fireEvent.click(screen.getByText("Content Warnings"));
    const graphicCheckbox = screen.getByRole("checkbox", {
      name: "Graphic/Explicit",
    });
    fireEvent.click(graphicCheckbox);

    expect(
      screen.getByText(/model release forms/)
    ).toBeInTheDocument();
  });

  it("shows Close Friends toggle", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    expect(screen.getByText("Close Friends")).toBeInTheDocument();
  });

  it("can toggle Close Friends", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    const closeFriendsLabel = screen.getByText("Close Friends");
    const checkbox = closeFriendsLabel
      .closest("label")
      ?.querySelector("input[type='checkbox']");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox!);
    expect(checkbox).toBeChecked();
  });

  it("shows auto-tag button when no flags make it hidden", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    expect(screen.getByTestId("auto-tag-button")).toBeInTheDocument();
  });

  it("opens content flags info modal when info button is clicked", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    fireEvent.click(screen.getByText("Content Warnings"));
    const infoButton = screen.getByTitle("Content flag guidelines");
    fireEvent.click(infoButton);
    expect(
      screen.getByTestId("content-flags-info-modal")
    ).toBeInTheDocument();
  });

  it("closes content flags info modal", () => {
    render(
      <PostComposer
        phoneVerified={true}
        isOldEnough={true}
      />
    );
    fireEvent.click(screen.getByText("Content Warnings"));
    const infoButton = screen.getByTitle("Content flag guidelines");
    fireEvent.click(infoButton);
    expect(
      screen.getByTestId("content-flags-info-modal")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Close Modal"));
    expect(
      screen.queryByTestId("content-flags-info-modal")
    ).not.toBeInTheDocument();
  });
});
