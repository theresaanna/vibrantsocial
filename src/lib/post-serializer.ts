import { prisma } from "@/lib/prisma";
import { fetchLinkPreview } from "@/app/feed/link-preview-action";
import {
  extractBlocksFromLexicalJson,
  type Block,
} from "@/lib/lexical-blocks";
import { extractFirstUrl } from "@/lib/lexical-text";
import {
  resolveAvatarFrame,
  resolveFontFamily,
  type SerializedAvatarFrame,
} from "@/lib/profile-lists";

/**
 * Subset of the User row needed to render a post card. Keep the select
 * fragment tight so list endpoints don't over-fetch.
 */
export const postAuthorSelect = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  avatar: true,
  image: true,
  tier: true,
  emailVerified: true,
  usernameFont: true,
  profileFrameId: true,
} as const;

/**
 * Full select fragment for post list queries. Wraps the viewer-state
 * joins in optional variants so callers can tailor per-endpoint needs.
 */
export const postSelect = {
  id: true,
  slug: true,
  content: true,
  authorId: true,
  isAuthorDeleted: true,
  isSensitive: true,
  isNsfw: true,
  isGraphicNudity: true,
  isPinned: true,
  hideLinkPreview: true,
  editedAt: true,
  createdAt: true,
  author: { select: postAuthorSelect },
  tags: {
    select: { tag: { select: { id: true, name: true } } },
  },
  _count: {
    select: {
      likes: true,
      comments: true,
      reposts: true,
      bookmarks: true,
      views: true,
    },
  },
} as const;

export interface SerializedPostAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  avatar: string | null;
  tier: string;
  verified: boolean;
  usernameFontFamily: string | null;
  frame: SerializedAvatarFrame | null;
}

export interface SerializedPostCounts {
  likes: number;
  comments: number;
  reposts: number;
  bookmarks: number;
  views: number;
}

export interface SerializedPostViewerState {
  liked: boolean;
  bookmarked: boolean;
  reposted: boolean;
  pollVoteOptionId: string | null;
}

export interface SerializedPost {
  id: string;
  slug: string | null;
  author: SerializedPostAuthor | null;
  blocks: Block[];
  isSensitive: boolean;
  isNsfw: boolean;
  isGraphicNudity: boolean;
  isPinned: boolean;
  createdAt: string;
  editedAt: string | null;
  counts: SerializedPostCounts;
  tags: string[];
  viewerState: SerializedPostViewerState;
}

/** Shape produced by Prisma with `postSelect`. */
type RawPost = {
  id: string;
  slug: string | null;
  content: string;
  authorId: string | null;
  isAuthorDeleted: boolean;
  isSensitive: boolean;
  isNsfw: boolean;
  isGraphicNudity: boolean;
  isPinned: boolean;
  hideLinkPreview: boolean;
  editedAt: Date | null;
  createdAt: Date;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    avatar: string | null;
    image: string | null;
    tier: string | null;
    emailVerified: Date | null;
    usernameFont: string | null;
    profileFrameId: string | null;
  } | null;
  tags: { tag: { id: string; name: string } }[];
  _count: {
    likes: number;
    comments: number;
    reposts: number;
    bookmarks: number;
    views: number;
  };
};

interface ViewerStateMaps {
  likedIds: Set<string>;
  bookmarkedIds: Set<string>;
  repostedIds: Set<string>;
  pollVotes: Map<string, string>;
}

/**
 * Look up every viewer-relative flag for a batch of posts in four small
 * queries rather than per-post N+1. Returns empty sets/maps when the
 * viewer is unauthenticated.
 */
async function loadViewerState(
  viewerId: string | null,
  postIds: string[],
): Promise<ViewerStateMaps> {
  const empty: ViewerStateMaps = {
    likedIds: new Set(),
    bookmarkedIds: new Set(),
    repostedIds: new Set(),
    pollVotes: new Map(),
  };
  if (!viewerId || postIds.length === 0) return empty;

  const [likes, bookmarks, reposts, pollVotes] = await Promise.all([
    prisma.like.findMany({
      where: { userId: viewerId, postId: { in: postIds } },
      select: { postId: true },
    }),
    prisma.bookmark.findMany({
      where: { userId: viewerId, postId: { in: postIds } },
      select: { postId: true },
    }),
    prisma.repost.findMany({
      where: { userId: viewerId, postId: { in: postIds } },
      select: { postId: true },
    }),
    prisma.pollVote.findMany({
      where: { userId: viewerId, postId: { in: postIds } },
      select: { postId: true, optionId: true },
    }),
  ]);

  return {
    likedIds: new Set(likes.map((l) => l.postId)),
    bookmarkedIds: new Set(bookmarks.map((b) => b.postId)),
    repostedIds: new Set(reposts.map((r) => r.postId)),
    pollVotes: new Map(pollVotes.map((v) => [v.postId, v.optionId])),
  };
}

/**
 * Serialize a batch of posts into the wire format consumed by
 * `/api/v1/feed` and `/api/v1/profile/:username/posts`. Handles:
 *   - Lexical → Block[] extraction
 *   - viewer-relative state (likes, bookmarks, reposts, poll votes)
 *   - optional link-preview append (respects post.hideLinkPreview)
 *   - author select + tier/verified flags
 */
export async function serializePosts(
  posts: RawPost[],
  viewerId: string | null,
  assetBaseUrl: string,
): Promise<SerializedPost[]> {
  const viewer = await loadViewerState(
    viewerId,
    posts.map((p) => p.id),
  );

  // Fetch link previews in parallel (cached for 7 days).
  const previewFetches = await Promise.all(
    posts.map(async (post) => {
      if (post.hideLinkPreview) return null;
      const url = extractFirstUrl(post.content);
      if (!url) return null;
      return fetchLinkPreview(url);
    }),
  );

  return posts.map((post, i) =>
    serializeWithViewer(post, viewer, previewFetches[i], assetBaseUrl),
  );
}

/** Single-post variant — same flow but without the batching overhead. */
export async function serializePost(
  post: RawPost,
  viewerId: string | null,
  assetBaseUrl: string,
): Promise<SerializedPost> {
  const [viewer, preview] = await Promise.all([
    loadViewerState(viewerId, [post.id]),
    post.hideLinkPreview ? Promise.resolve(null) : linkPreviewForPost(post),
  ]);
  return serializeWithViewer(post, viewer, preview, assetBaseUrl);
}

async function linkPreviewForPost(post: RawPost) {
  const url = extractFirstUrl(post.content);
  if (!url) return null;
  return fetchLinkPreview(url);
}

function serializeWithViewer(
  post: RawPost,
  viewer: ViewerStateMaps,
  preview: Awaited<ReturnType<typeof fetchLinkPreview>> | null,
  assetBaseUrl: string,
): SerializedPost {
  const blocks = extractBlocksFromLexicalJson(post.content);

  // Append a link-preview block when the post has a non-YouTube URL and
  // the author hasn't opted out. Skipping when the preview fetch failed
  // or the content already has a YouTube embed (the YT thumbnail already
  // serves as a preview).
  if (preview && !blocks.some((b) => b.type === "youtube")) {
    blocks.push({
      type: "link_preview",
      url: preview.url,
      title: preview.title ?? undefined,
      description: preview.description ?? undefined,
      image: preview.image ?? undefined,
    });
  }

  // Enrich poll blocks with the viewer's vote (if any).
  const pollVote = viewer.pollVotes.get(post.id) ?? null;
  if (pollVote) {
    for (const block of blocks) {
      if (block.type === "poll") {
        block.viewerVoteOptionId = pollVote;
      }
    }
  }

  const author: SerializedPostAuthor | null =
    !post.author || post.isAuthorDeleted
      ? null
      : {
          id: post.author.id,
          username: post.author.username,
          displayName: post.author.displayName,
          name: post.author.name,
          avatar: post.author.avatar ?? post.author.image,
          tier: post.author.tier ?? "free",
          verified: post.author.emailVerified != null,
          usernameFontFamily: resolveFontFamily(
            post.author.usernameFont,
            post.author.tier,
          ),
          frame: resolveAvatarFrame(
            post.author.profileFrameId,
            assetBaseUrl,
          ),
        };

  return {
    id: post.id,
    slug: post.slug,
    author,
    blocks,
    isSensitive: post.isSensitive,
    isNsfw: post.isNsfw,
    isGraphicNudity: post.isGraphicNudity,
    isPinned: post.isPinned,
    createdAt: post.createdAt.toISOString(),
    editedAt: post.editedAt?.toISOString() ?? null,
    counts: {
      likes: post._count.likes,
      comments: post._count.comments,
      reposts: post._count.reposts,
      bookmarks: post._count.bookmarks,
      views: post._count.views,
    },
    tags: post.tags.map((t) => t.tag.name),
    viewerState: {
      liked: viewer.likedIds.has(post.id),
      bookmarked: viewer.bookmarkedIds.has(post.id),
      reposted: viewer.repostedIds.has(post.id),
      pollVoteOptionId: pollVote,
    },
  };
}
