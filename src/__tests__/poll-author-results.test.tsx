import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostAuthorProvider, useIsPostAuthor } from "@/components/editor/PostAuthorContext";

// Simple test component to verify context
function TestConsumer() {
  const isAuthor = useIsPostAuthor();
  return <div data-testid="is-author">{isAuthor ? "true" : "false"}</div>;
}

describe("PostAuthorContext", () => {
  it("defaults to false when no provider", () => {
    render(<TestConsumer />);
    expect(screen.getByTestId("is-author").textContent).toBe("false");
  });

  it("provides true when isPostAuthor is true", () => {
    render(
      <PostAuthorProvider isPostAuthor={true}>
        <TestConsumer />
      </PostAuthorProvider>
    );
    expect(screen.getByTestId("is-author").textContent).toBe("true");
  });

  it("provides false when isPostAuthor is false", () => {
    render(
      <PostAuthorProvider isPostAuthor={false}>
        <TestConsumer />
      </PostAuthorProvider>
    );
    expect(screen.getByTestId("is-author").textContent).toBe("false");
  });
});

describe("PostContent passes isPostAuthor to EditorContent", () => {
  it("passes isPostAuthor prop through", async () => {
    const editorContentSpy = vi.fn().mockReturnValue(null);
    vi.doMock("@/components/editor/EditorContent", () => ({
      EditorContent: (props: Record<string, unknown>) => {
        editorContentSpy(props);
        return null;
      },
    }));

    const { PostContent } = await import("@/components/post-content");
    render(<PostContent content='{"root":{"type":"root","children":[]}}' isPostAuthor={true} />);
    expect(editorContentSpy).toHaveBeenCalledWith(
      expect.objectContaining({ isPostAuthor: true })
    );

    vi.doUnmock("@/components/editor/EditorContent");
  });
});
