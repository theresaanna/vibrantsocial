import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Mock all Lexical dependencies before importing Editor
vi.mock("@lexical/react/LexicalComposer", () => ({
  LexicalComposer: ({
    children,
  }: {
    children: React.ReactNode;
    initialConfig: unknown;
  }) => <div data-testid="lexical-composer">{children}</div>,
}));
vi.mock("@lexical/react/LexicalRichTextPlugin", () => ({
  RichTextPlugin: ({
    contentEditable,
    placeholder,
  }: {
    contentEditable: React.ReactNode;
    placeholder: React.ReactNode;
    ErrorBoundary: unknown;
  }) => (
    <div>
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
vi.mock("@lexical/react/LexicalClickableLinkPlugin", () => ({
  ClickableLinkPlugin: () => null,
}));
vi.mock("@lexical/react/LexicalComposerContext", () => ({
  useLexicalComposerContext: () => [{}],
}));
vi.mock("@/components/editor/plugins/CollapsiblePlugin", () => ({
  CollapsiblePlugin: () => null,
}));
vi.mock("@/components/editor/plugins/DraftPlugin", () => ({
  DraftPlugin: () => null,
}));

import { Editor } from "@/components/editor/Editor";

describe("Editor dropdown overflow", () => {
  it("does not have overflow-hidden on the outer container", () => {
    const { container } = render(<Editor />);

    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv).not.toHaveClass("overflow-hidden");
  });

  it("has rounded-lg and border on the outer container", () => {
    const { container } = render(<Editor />);

    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv).toHaveClass("rounded-lg");
    expect(outerDiv).toHaveClass("border");
  });

  it("content area retains overflow-auto for scrolling", () => {
    const { container } = render(<Editor />);

    const contentArea = container.querySelector(".resize-y");
    expect(contentArea).toHaveClass("overflow-auto");
  });
});
