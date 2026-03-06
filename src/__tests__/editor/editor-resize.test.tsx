import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { BioEditor } from "@/components/bio-editor";

// Mock the Editor to inspect the props it receives
let capturedProps: Record<string, unknown> = {};

vi.mock("@/components/editor/Editor", () => ({
  Editor: (props: Record<string, unknown>) => {
    capturedProps = props;
    return (
      <div
        data-testid="mock-editor"
        data-min-height={props.minHeight}
        data-placeholder={props.placeholder}
      />
    );
  },
}));

describe("BioEditor", () => {
  it("passes 188px minHeight to Editor (25% taller than original 150px)", () => {
    render(<BioEditor />);
    expect(capturedProps.minHeight).toBe("188px");
  });

  it("passes correct placeholder text", () => {
    render(<BioEditor />);
    expect(capturedProps.placeholder).toBe("Tell us about yourself...");
  });

  it("passes inputName 'bio' to Editor", () => {
    render(<BioEditor />);
    expect(capturedProps.inputName).toBe("bio");
  });

  it("forwards initialContent to Editor", () => {
    render(<BioEditor initialContent='{"root":{}}' />);
    expect(capturedProps.initialContent).toBe('{"root":{}}');
  });

  it("handles null initialContent", () => {
    render(<BioEditor initialContent={null} />);
    expect(capturedProps.initialContent).toBeNull();
  });
});
