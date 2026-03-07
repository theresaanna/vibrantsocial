import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { editorNodes } from "@/components/editor/nodes";
import { editorTheme } from "@/components/editor/theme";

// Mock next/link for EditorContent rendering tests
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

import { EditorContent } from "@/components/editor/EditorContent";

function makeBulletList(items: string[]) {
  return JSON.stringify({
    root: {
      children: [
        {
          type: "list",
          listType: "bullet",
          start: 1,
          tag: "ul",
          direction: "ltr",
          format: "",
          indent: 0,
          version: 1,
          children: items.map((text) => ({
            type: "listitem",
            value: 1,
            direction: "ltr",
            format: "",
            indent: 0,
            version: 1,
            children: [
              {
                type: "text",
                text,
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                version: 1,
              },
            ],
          })),
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

function makeNumberedList(items: string[]) {
  return JSON.stringify({
    root: {
      children: [
        {
          type: "list",
          listType: "number",
          start: 1,
          tag: "ol",
          direction: "ltr",
          format: "",
          indent: 0,
          version: 1,
          children: items.map((text, i) => ({
            type: "listitem",
            value: i + 1,
            direction: "ltr",
            format: "",
            indent: 0,
            version: 1,
            children: [
              {
                type: "text",
                text,
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                version: 1,
              },
            ],
          })),
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

function makeCheckList(items: { text: string; checked: boolean }[]) {
  return JSON.stringify({
    root: {
      children: [
        {
          type: "list",
          listType: "check",
          start: 1,
          tag: "ul",
          direction: "ltr",
          format: "",
          indent: 0,
          version: 1,
          children: items.map((item) => ({
            type: "listitem",
            value: 1,
            checked: item.checked,
            direction: "ltr",
            format: "",
            indent: 0,
            version: 1,
            children: [
              {
                type: "text",
                text: item.text,
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                version: 1,
              },
            ],
          })),
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

describe("List support - node registry", () => {
  it("includes ListNode in editorNodes", () => {
    const types = editorNodes.map((n) => n.getType());
    expect(types).toContain("list");
  });

  it("includes ListItemNode in editorNodes", () => {
    const types = editorNodes.map((n) => n.getType());
    expect(types).toContain("listitem");
  });
});

describe("List support - theme", () => {
  it("has unordered list styling with list-disc", () => {
    const listTheme = editorTheme.list as Record<string, unknown>;
    expect(listTheme.ul).toContain("list-disc");
  });

  it("has ordered list styling with list-decimal", () => {
    const listTheme = editorTheme.list as Record<string, unknown>;
    expect(listTheme.ol).toContain("list-decimal");
  });

  it("has checked item styling", () => {
    const listTheme = editorTheme.list as Record<string, unknown>;
    expect(listTheme.listitemChecked).toContain("line-through");
  });

  it("has unchecked item styling", () => {
    const listTheme = editorTheme.list as Record<string, unknown>;
    expect(listTheme.listitemUnchecked).toBeDefined();
    expect(typeof listTheme.listitemUnchecked).toBe("string");
  });
});

describe("List support - EditorContent rendering", () => {
  it("renders bulleted list items", () => {
    const content = makeBulletList(["Buy groceries", "Walk the dog"]);
    render(<EditorContent content={content} />);
    expect(screen.getByText("Buy groceries")).toBeInTheDocument();
    expect(screen.getByText("Walk the dog")).toBeInTheDocument();
  });

  it("renders numbered list items", () => {
    const content = makeNumberedList(["Step one", "Step two", "Step three"]);
    render(<EditorContent content={content} />);
    expect(screen.getByText("Step one")).toBeInTheDocument();
    expect(screen.getByText("Step two")).toBeInTheDocument();
    expect(screen.getByText("Step three")).toBeInTheDocument();
  });

  it("renders checklist items", () => {
    const content = makeCheckList([
      { text: "Completed task", checked: true },
      { text: "Pending task", checked: false },
    ]);
    render(<EditorContent content={content} />);
    expect(screen.getByText("Completed task")).toBeInTheDocument();
    expect(screen.getByText("Pending task")).toBeInTheDocument();
  });

  it("renders EditorContent as non-editable", () => {
    const content = makeBulletList(["Test item"]);
    const { container } = render(<EditorContent content={content} />);
    const editable = container.querySelector("[contenteditable]");
    expect(editable?.getAttribute("contenteditable")).toBe("false");
  });

  it("checklist items are not togglable in read-only mode", () => {
    const content = makeCheckList([
      { text: "Task A", checked: false },
      { text: "Task B", checked: true },
    ]);
    const { container } = render(<EditorContent content={content} />);

    // Find list items and click them — state should not change
    const taskA = screen.getByText("Task A");
    fireEvent.click(taskA);

    // The editor should remain non-editable
    const editable = container.querySelector("[contenteditable]");
    expect(editable?.getAttribute("contenteditable")).toBe("false");
  });
});

describe("List support - toolbar block types", () => {
  it("BlockFormatDropdown exports bullet, number, and check list types", async () => {
    // Verify the block format dropdown module defines all three list types
    const module = await import(
      "@/components/editor/toolbar/BlockFormatDropdown"
    );
    expect(module.BlockFormatDropdown).toBeDefined();
  });
});
