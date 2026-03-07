import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PostRevisionHistory } from "@/components/post-revision-history";

const mockGetPostRevisions = vi.fn();
const mockRestorePostRevision = vi.fn();

vi.mock("@/app/feed/actions", () => ({
  getPostRevisions: (...args: unknown[]) => mockGetPostRevisions(...args),
  restorePostRevision: (...args: unknown[]) => mockRestorePostRevision(...args),
}));

vi.mock("@/components/editor/EditorContent", () => ({
  EditorContent: ({ content }: { content: string }) => (
    <div data-testid="editor-content">{content}</div>
  ),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "2h ago",
}));

describe("PostRevisionHistory", () => {
  const onClose = vi.fn();
  const onRestore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    mockGetPostRevisions.mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <PostRevisionHistory
        postId="post1"
        onClose={onClose}
        onRestore={onRestore}
      />
    );
    expect(screen.getByText("Loading revisions...")).toBeInTheDocument();
  });

  it("shows empty state when no revisions", async () => {
    mockGetPostRevisions.mockResolvedValue([]);
    render(
      <PostRevisionHistory
        postId="post1"
        onClose={onClose}
        onRestore={onRestore}
      />
    );
    await waitFor(() => {
      expect(
        screen.getByText(/No previous revisions yet/)
      ).toBeInTheDocument();
    });
  });

  it("renders revision list", async () => {
    mockGetPostRevisions.mockResolvedValue([
      { id: "rev1", content: "Old content 1", createdAt: new Date("2024-01-01") },
      { id: "rev2", content: "Old content 2", createdAt: new Date("2024-01-02") },
    ]);
    render(
      <PostRevisionHistory
        postId="post1"
        onClose={onClose}
        onRestore={onRestore}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("revision-item-rev1")).toBeInTheDocument();
      expect(screen.getByTestId("revision-item-rev2")).toBeInTheDocument();
    });
  });

  it("shows preview of first revision by default", async () => {
    mockGetPostRevisions.mockResolvedValue([
      { id: "rev1", content: "First revision content", createdAt: new Date("2024-01-01") },
    ]);
    render(
      <PostRevisionHistory
        postId="post1"
        onClose={onClose}
        onRestore={onRestore}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("editor-content")).toHaveTextContent(
        "First revision content"
      );
    });
  });

  it("shows preview of selected revision", async () => {
    mockGetPostRevisions.mockResolvedValue([
      { id: "rev1", content: "Content A", createdAt: new Date("2024-01-01") },
      { id: "rev2", content: "Content B", createdAt: new Date("2024-01-02") },
    ]);
    render(
      <PostRevisionHistory
        postId="post1"
        onClose={onClose}
        onRestore={onRestore}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("revision-item-rev2")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("revision-item-rev2"));
    expect(screen.getByTestId("editor-content")).toHaveTextContent("Content B");
  });

  it("shows restore button when revision is selected", async () => {
    mockGetPostRevisions.mockResolvedValue([
      { id: "rev1", content: "Old content", createdAt: new Date("2024-01-01") },
    ]);
    render(
      <PostRevisionHistory
        postId="post1"
        onClose={onClose}
        onRestore={onRestore}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("revision-restore-button")).toBeInTheDocument();
    });
  });

  it("calls restorePostRevision and onRestore on restore", async () => {
    mockGetPostRevisions.mockResolvedValue([
      { id: "rev1", content: "Old content", createdAt: new Date("2024-01-01") },
    ]);
    mockRestorePostRevision.mockResolvedValue({
      success: true,
      message: "Restored",
      restoredContent: "Old content",
    });
    render(
      <PostRevisionHistory
        postId="post1"
        onClose={onClose}
        onRestore={onRestore}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("revision-restore-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("revision-restore-button"));
    await waitFor(() => {
      expect(mockRestorePostRevision).toHaveBeenCalledWith("rev1");
      expect(onRestore).toHaveBeenCalledWith("Old content");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("closes on Escape key", async () => {
    mockGetPostRevisions.mockResolvedValue([]);
    render(
      <PostRevisionHistory
        postId="post1"
        onClose={onClose}
        onRestore={onRestore}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on overlay click", async () => {
    mockGetPostRevisions.mockResolvedValue([]);
    render(
      <PostRevisionHistory
        postId="post1"
        onClose={onClose}
        onRestore={onRestore}
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("revision-overlay")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("revision-overlay"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls getPostRevisions with the postId", async () => {
    mockGetPostRevisions.mockResolvedValue([]);
    render(
      <PostRevisionHistory
        postId="my-post-123"
        onClose={onClose}
        onRestore={onRestore}
      />
    );
    expect(mockGetPostRevisions).toHaveBeenCalledWith("my-post-123");
  });
});
