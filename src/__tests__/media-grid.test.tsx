import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MediaGrid } from "@/components/media-grid";

const mockFetchMediaFeedPage = vi.fn();

vi.mock("@/app/feed/media-actions", () => ({
  fetchMediaFeedPage: (...args: unknown[]) => mockFetchMediaFeedPage(...args),
}));

vi.mock("@/components/framed-avatar", () => ({
  FramedAvatar: ({ alt }: { alt: string }) => <span data-testid="avatar">{alt}</span>,
}));

vi.mock("@/lib/time", () => ({
  timeAgo: () => "5m ago",
}));

function makeLexicalJson(children: unknown[]) {
  return JSON.stringify({
    root: {
      children,
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  });
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    slug: "test-post",
    content: makeLexicalJson([
      {
        type: "paragraph",
        children: [
          {
            type: "image",
            src: "https://example.com/photo.jpg",
            altText: "Test image",
            width: 800,
            height: 600,
            version: 1,
          },
        ],
      },
    ]),
    createdAt: "2026-03-20T10:00:00Z",
    author: {
      id: "user-1",
      username: "testuser",
      displayName: "Test User",
      name: "Test",
      image: null,
      avatar: "https://example.com/avatar.jpg",
      profileFrameId: null,
    },
    ...overrides,
  };
}

describe("MediaGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock IntersectionObserver
    const mockObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn(),
    }));
    vi.stubGlobal("IntersectionObserver", mockObserver);
  });

  it("renders media grid items for posts with media", () => {
    render(<MediaGrid initialPosts={[makePost()]} initialHasMore={false} />);

    expect(screen.getByTestId("media-grid")).toBeInTheDocument();
    expect(screen.getAllByTestId("media-grid-item")).toHaveLength(1);
  });

  it("renders multiple media items from a single post", () => {
    const post = makePost({
      content: makeLexicalJson([
        {
          type: "paragraph",
          children: [
            { type: "image", src: "https://example.com/1.jpg", altText: "First", width: 800, height: 600, version: 1 },
            { type: "image", src: "https://example.com/2.jpg", altText: "Second", width: 400, height: 300, version: 1 },
          ],
        },
      ]),
    });

    render(<MediaGrid initialPosts={[post]} initialHasMore={false} />);

    expect(screen.getAllByTestId("media-grid-item")).toHaveLength(2);
  });

  it("renders empty state when no posts have media", () => {
    const post = makePost({
      content: makeLexicalJson([
        { type: "paragraph", children: [{ type: "text", text: "No media here" }] },
      ]),
    });

    render(<MediaGrid initialPosts={[post]} initialHasMore={false} />);

    expect(screen.getByText("No media yet.")).toBeInTheDocument();
  });

  it("renders empty state when no posts provided", () => {
    render(<MediaGrid initialPosts={[]} initialHasMore={false} />);

    expect(screen.getByText("No media yet.")).toBeInTheDocument();
  });

  it("renders end-of-list message when no more items", () => {
    render(<MediaGrid initialPosts={[makePost()]} initialHasMore={false} />);

    expect(screen.getByText("No more media to show.")).toBeInTheDocument();
  });

  it("does not render end-of-list message when hasMore is true", () => {
    render(<MediaGrid initialPosts={[makePost()]} initialHasMore={true} />);

    expect(screen.queryByText("No more media to show.")).not.toBeInTheDocument();
  });

  it("links media items to the correct post URL with username and slug", () => {
    render(<MediaGrid initialPosts={[makePost()]} initialHasMore={false} />);

    const link = screen.getByTestId("media-grid-item");
    expect(link).toHaveAttribute("href", "/testuser/post/test-post");
  });

  it("falls back to /post/[id] when slug or username is missing", () => {
    const post = makePost({ slug: null, author: { ...makePost().author, username: null } });

    render(<MediaGrid initialPosts={[post]} initialHasMore={false} />);

    const link = screen.getByTestId("media-grid-item");
    expect(link).toHaveAttribute("href", "/post/post-1");
  });

  it("renders video thumbnails with play button overlay", () => {
    const post = makePost({
      content: makeLexicalJson([
        {
          type: "paragraph",
          children: [
            { type: "video", src: "https://example.com/clip.mp4", fileName: "clip.mp4", mimeType: "video/mp4", version: 1 },
          ],
        },
      ]),
    });

    render(<MediaGrid initialPosts={[post]} initialHasMore={false} />);

    expect(screen.getByTestId("media-grid-item")).toBeInTheDocument();
    // Video should have a video element
    const video = document.querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.getAttribute("src")).toBe("https://example.com/clip.mp4");
  });

  it("renders YouTube thumbnails", () => {
    const post = makePost({
      content: makeLexicalJson([
        { type: "youtube", videoID: "dQw4w9WgXcQ", version: 1 },
      ]),
    });

    render(<MediaGrid initialPosts={[post]} initialHasMore={false} />);

    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("loads more posts when scrolling triggers intersection observer", async () => {
    mockFetchMediaFeedPage.mockResolvedValue({
      posts: [makePost({ id: "post-2", slug: "second-post", createdAt: "2026-03-19T10:00:00Z" })],
      hasMore: false,
    });

    render(<MediaGrid initialPosts={[makePost()]} initialHasMore={true} />);

    // Get the IntersectionObserver callback and trigger it
    const observerCallback = (IntersectionObserver as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    observerCallback([{ isIntersecting: true }]);

    await waitFor(() => {
      expect(mockFetchMediaFeedPage).toHaveBeenCalledWith("2026-03-20T10:00:00Z");
    });
  });
});
