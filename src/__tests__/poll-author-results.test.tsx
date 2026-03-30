import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PostAuthorProvider, useIsPostAuthor, usePostContext } from "@/components/editor/PostAuthorContext";

// Simple test component to verify context
function TestConsumer() {
  const isAuthor = useIsPostAuthor();
  return <div data-testid="is-author">{isAuthor ? "true" : "false"}</div>;
}

function FullContextConsumer() {
  const ctx = usePostContext();
  return (
    <div>
      <span data-testid="is-author">{ctx.isPostAuthor ? "true" : "false"}</span>
      <span data-testid="post-id">{ctx.postId ?? "null"}</span>
      <span data-testid="current-user-id">{ctx.currentUserId ?? "null"}</span>
    </div>
  );
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

  it("provides postId and currentUserId via usePostContext", () => {
    render(
      <PostAuthorProvider isPostAuthor={true} postId="post-1" currentUserId="user-1">
        <FullContextConsumer />
      </PostAuthorProvider>
    );
    expect(screen.getByTestId("post-id").textContent).toBe("post-1");
    expect(screen.getByTestId("current-user-id").textContent).toBe("user-1");
  });

  it("defaults postId and currentUserId to null", () => {
    render(
      <PostAuthorProvider isPostAuthor={false}>
        <FullContextConsumer />
      </PostAuthorProvider>
    );
    expect(screen.getByTestId("post-id").textContent).toBe("null");
    expect(screen.getByTestId("current-user-id").textContent).toBe("null");
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

  it("passes postId and currentUserId to EditorContent", async () => {
    vi.resetModules();
    const editorContentSpy = vi.fn().mockReturnValue(null);
    vi.doMock("@/components/editor/EditorContent", () => ({
      EditorContent: (props: Record<string, unknown>) => {
        editorContentSpy(props);
        return null;
      },
    }));

    const { PostContent } = await import("@/components/post-content");
    render(
      <PostContent
        content='{"root":{"type":"root","children":[]}}'
        isPostAuthor={false}
        postId="p1"
        currentUserId="u1"
      />
    );
    expect(editorContentSpy).toHaveBeenCalledWith(
      expect.objectContaining({ postId: "p1", currentUserId: "u1" })
    );

    vi.doUnmock("@/components/editor/EditorContent");
  });
});
