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

import { Editor } from "@/components/editor/Editor";

describe("Editor container", () => {
  it("renders with resize-y class for vertical resizing", () => {
    const { container } = render(<Editor minHeight="188px" />);

    const resizeDiv = container.querySelector(".resize-y");
    expect(resizeDiv).toBeTruthy();
    expect(resizeDiv).toHaveClass("overflow-auto");
  });

  it("applies minHeight as inline style on the resizable container", () => {
    const { container } = render(<Editor minHeight="188px" />);

    const resizeDiv = container.querySelector(".resize-y");
    expect(resizeDiv).toHaveStyle({ minHeight: "188px" });
  });

  it("uses default 120px minHeight when not specified", () => {
    const { container } = render(<Editor />);

    const resizeDiv = container.querySelector(".resize-y");
    expect(resizeDiv).toBeTruthy();
    expect(resizeDiv).toHaveStyle({ minHeight: "120px" });
  });

  it("does not apply minHeight on ContentEditable (moved to container)", () => {
    const { getByTestId } = render(<Editor minHeight="188px" />);

    const contentEditable = getByTestId("content-editable");
    expect(contentEditable).not.toHaveStyle({ minHeight: "188px" });
  });
});
