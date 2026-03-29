import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostCard } from "@/components/post-card";

vi.mock("@/components/post-content", () => ({
  PostContent: ({ content }: { content: string }) => (
    <div data-testid="post-content">{content}</div>
  ),
}));
vi.mock("@/components/post-actions", () => ({
  PostActions: () => <div data-testid="post-actions">actions</div>,
}));
vi.mock("@/components/comment-section", () => ({
  CommentSection: () => <div data-testid="comment-section">comments</div>,
}));
vi.mock("@/components/post-revision-history", () => ({
  PostRevisionHistory: () => <div data-testid="post-revision-history" />,
}));
vi.mock("@/components/editor/Editor", () => ({
  Editor: () => <div data-testid="mock-editor" />,
}));
vi.mock("@/components/editor/plugins/DraftPlugin", () => ({
  clearDraft: vi.fn(),
}));
vi.mock("@/components/tag-input", () => ({
  TagInput: () => <div data-testid="tag-input" />,
}));
vi.mock("@/components/content-flags-info-modal", () => ({
  ContentFlagsInfoModal: () => <div data-testid="content-flags-info-modal" />,
}));
vi.mock("@/app/providers", () => ({
  useAblyReady: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/ably", () => ({
  getAblyRealtimeClient: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/app/feed/actions", () => ({
  editPost: vi.fn(),
  deletePost: vi.fn(),
  updatePostChecklist: vi.fn(),
  togglePinPost: vi.fn().mockResolvedValue({ success: true, message: "" }),
}));
vi.mock("@/lib/time", () => ({
  timeAgo: () => "1m ago",
}));

const basePost = {
  id: "post1",
  content: "Test content",
  createdAt: new Date(),
  isSensitive: false,
  isNsfw: false,
  isGraphicNudity: false,
  isPinned: false,
  author: {
    id: "user1",
    username: "testuser",
    displayName: "Test User",
    name: "Test",
    image: null,
    avatar: null,
    profileFrameId: null,
  },
  tags: [],
  _count: { comments: 0, likes: 0, bookmarks: 0, reposts: 0 },
  likes: [],
  bookmarks: [],
  reposts: [],
  comments: [],
};

const defaultProps = {
  currentUserId: "viewer1",
  phoneVerified: true,
  ageVerified: true,
  showGraphicByDefault: false,
  showNsfwContent: true,
  hideSensitiveOverlay: false,
};

describe("Content overlay opt-in feature", () => {
  describe("NSFW overlay is always shown (no opt-out)", () => {
    it("shows overlay when showNsfwContent=true", () => {
      render(
        <PostCard
          post={{ ...basePost, isNsfw: true }}
          {...defaultProps}
          showNsfwContent={true}
        />
      );
      expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
      expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    });

    it("shows overlay when showNsfwContent=false", () => {
      render(
        <PostCard
          post={{ ...basePost, isNsfw: true }}
          {...defaultProps}
          showNsfwContent={false}
        />
      );
      expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
      expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    });

    it("shows overlay even with all other opt-ins enabled", () => {
      render(
        <PostCard
          post={{ ...basePost, isNsfw: true }}
          {...defaultProps}
          showNsfwContent={true}
          hideSensitiveOverlay={true}
          showGraphicByDefault={true}
        />
      );
      expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
      expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    });

    it("can be revealed by clicking Show content", () => {
      render(
        <PostCard
          post={{ ...basePost, isNsfw: true }}
          {...defaultProps}
          showNsfwContent={true}
        />
      );
      fireEvent.click(screen.getByText("Show content"));
      expect(screen.getByTestId("post-content")).toBeInTheDocument();
    });
  });

  describe("Sensitive overlay opt-in (hideSensitiveOverlay)", () => {
    it("shows overlay by default when age verified", () => {
      render(
        <PostCard
          post={{ ...basePost, isSensitive: true }}
          {...defaultProps}
          hideSensitiveOverlay={false}
        />
      );
      expect(screen.getByText("Click to view sensitive content")).toBeInTheDocument();
      expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    });

    it("hides overlay when opted in", () => {
      render(
        <PostCard
          post={{ ...basePost, isSensitive: true }}
          {...defaultProps}
          hideSensitiveOverlay={true}
        />
      );
      expect(screen.getByTestId("post-content")).toBeInTheDocument();
      expect(screen.queryByText("Click to view sensitive content")).not.toBeInTheDocument();
    });

    it("still shows age-verify gate even with opt-in when not age verified", () => {
      render(
        <PostCard
          post={{ ...basePost, isSensitive: true }}
          {...defaultProps}
          ageVerified={false}
          hideSensitiveOverlay={true}
        />
      );
      expect(screen.getByText("Verify your age to view this content.")).toBeInTheDocument();
      expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    });

    it("does not affect NSFW overlay", () => {
      render(
        <PostCard
          post={{ ...basePost, isNsfw: true }}
          {...defaultProps}
          hideSensitiveOverlay={true}
        />
      );
      expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
    });

    it("does not affect Graphic/Explicit overlay", () => {
      render(
        <PostCard
          post={{ ...basePost, isGraphicNudity: true }}
          {...defaultProps}
          hideSensitiveOverlay={true}
          showGraphicByDefault={false}
        />
      );
      expect(screen.getByText("Click to view graphic content")).toBeInTheDocument();
    });
  });

  describe("Graphic/Explicit overlay opt-in (showGraphicByDefault)", () => {
    it("shows overlay by default when age verified", () => {
      render(
        <PostCard
          post={{ ...basePost, isGraphicNudity: true }}
          {...defaultProps}
          showGraphicByDefault={false}
        />
      );
      expect(screen.getByText("Click to view graphic content")).toBeInTheDocument();
      expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    });

    it("hides overlay when opted in", () => {
      render(
        <PostCard
          post={{ ...basePost, isGraphicNudity: true }}
          {...defaultProps}
          showGraphicByDefault={true}
        />
      );
      expect(screen.getByTestId("post-content")).toBeInTheDocument();
      expect(screen.queryByText("Click to view graphic content")).not.toBeInTheDocument();
    });

    it("still shows age-verify gate even with opt-in when not age verified", () => {
      render(
        <PostCard
          post={{ ...basePost, isGraphicNudity: true }}
          {...defaultProps}
          ageVerified={false}
          showGraphicByDefault={true}
        />
      );
      expect(screen.getByText("Verify your age to view this content.")).toBeInTheDocument();
      expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    });

    it("does not affect NSFW overlay", () => {
      render(
        <PostCard
          post={{ ...basePost, isNsfw: true }}
          {...defaultProps}
          showGraphicByDefault={true}
        />
      );
      expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
    });

    it("does not affect Sensitive overlay", () => {
      render(
        <PostCard
          post={{ ...basePost, isSensitive: true }}
          {...defaultProps}
          showGraphicByDefault={true}
          hideSensitiveOverlay={false}
        />
      );
      expect(screen.getByText("Click to view sensitive content")).toBeInTheDocument();
    });
  });

  describe("Combined flags with opt-ins", () => {
    it("sensitive+graphic: both opt-ins hide both overlays", () => {
      render(
        <PostCard
          post={{ ...basePost, isSensitive: true, isGraphicNudity: true }}
          {...defaultProps}
          hideSensitiveOverlay={true}
          showGraphicByDefault={true}
        />
      );
      expect(screen.getByTestId("post-content")).toBeInTheDocument();
      expect(screen.queryByText(/overlay|reveal/i)).not.toBeInTheDocument();
    });

    it("sensitive+graphic: only sensitive opt-in still shows graphic overlay", () => {
      render(
        <PostCard
          post={{ ...basePost, isSensitive: true, isGraphicNudity: true }}
          {...defaultProps}
          hideSensitiveOverlay={true}
          showGraphicByDefault={false}
        />
      );
      // Graphic overlay should show since graphic opt-in is off
      expect(screen.getByText("Click to view graphic content")).toBeInTheDocument();
    });

    it("sensitive+nsfw: sensitive opt-in still shows nsfw overlay", () => {
      render(
        <PostCard
          post={{ ...basePost, isSensitive: true, isNsfw: true }}
          {...defaultProps}
          hideSensitiveOverlay={true}
        />
      );
      // NSFW always shows overlay
      expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
    });

    it("graphic+nsfw: graphic opt-in still shows nsfw overlay", () => {
      render(
        <PostCard
          post={{ ...basePost, isGraphicNudity: true, isNsfw: true }}
          {...defaultProps}
          showGraphicByDefault={true}
        />
      );
      // NSFW always shows overlay
      expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
    });

    it("all three flags with all opt-ins: nsfw overlay still shows", () => {
      render(
        <PostCard
          post={{ ...basePost, isSensitive: true, isNsfw: true, isGraphicNudity: true }}
          {...defaultProps}
          hideSensitiveOverlay={true}
          showGraphicByDefault={true}
        />
      );
      expect(screen.getByText("Click to view NSFW content")).toBeInTheDocument();
      expect(screen.queryByTestId("post-content")).not.toBeInTheDocument();
    });

    it("all three flags with all opt-ins: reveals all content after click", () => {
      render(
        <PostCard
          post={{ ...basePost, isSensitive: true, isNsfw: true, isGraphicNudity: true }}
          {...defaultProps}
          hideSensitiveOverlay={true}
          showGraphicByDefault={true}
        />
      );
      fireEvent.click(screen.getByText("Show content"));
      expect(screen.getByTestId("post-content")).toBeInTheDocument();
      expect(screen.getByText("Sensitive / NSFW / Graphic/Explicit")).toBeInTheDocument();
    });
  });

  describe("Opt-in defaults are opt-out (false by default)", () => {
    it("hideSensitiveOverlay defaults cause overlay to show", () => {
      render(
        <PostCard
          post={{ ...basePost, isSensitive: true }}
          {...defaultProps}
          hideSensitiveOverlay={false}
        />
      );
      expect(screen.getByText("Click to view sensitive content")).toBeInTheDocument();
    });

    it("showGraphicByDefault defaults cause overlay to show", () => {
      render(
        <PostCard
          post={{ ...basePost, isGraphicNudity: true }}
          {...defaultProps}
          showGraphicByDefault={false}
        />
      );
      expect(screen.getByText("Click to view graphic content")).toBeInTheDocument();
    });
  });
});
