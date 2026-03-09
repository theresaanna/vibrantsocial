"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import { PostContent } from "./post-content";
import { PostActions } from "./post-actions";
import { CommentSection } from "./comment-section";
import { PostRevisionHistory } from "./post-revision-history";
import { Editor } from "./editor/Editor";
import { clearDraft } from "./editor/plugins/DraftPlugin";
import { editPost, deletePost, updatePostChecklist, togglePinPost } from "@/app/feed/actions";
import { useRouter } from "next/navigation";
import { TagInput } from "./tag-input";
import { ContentFlagsInfoModal } from "./content-flags-info-modal";
import { timeAgo } from "@/lib/time";
import Link from "next/link";

interface PostAuthor {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
}

interface CommentData {
  id: string;
  content: string;
  createdAt: Date;
  author: PostAuthor;
}

interface PostCardProps {
  post: {
    id: string;
    content: string;
    createdAt: Date;
    editedAt?: Date | null;
    isAuthorDeleted?: boolean;
    isSensitive: boolean;
    isNsfw: boolean;
    isGraphicNudity: boolean;
    isPinned: boolean;
    author: PostAuthor | null;
    tags?: Array<{ tag: { name: string } }>;
    _count: {
      comments: number;
      likes: number;
      bookmarks: number;
      reposts: number;
    };
    likes: Array<{ id: string }>;
    bookmarks: Array<{ id: string }>;
    reposts: Array<{ id: string }>;
    comments?: CommentData[];
  };
  currentUserId?: string;
  phoneVerified: boolean;
  biometricVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  defaultShowComments?: boolean;
  defaultExpanded?: boolean;
  highlightCommentId?: string | null;
}

export function PostCard({
  post,
  currentUserId,
  phoneVerified,
  biometricVerified,
  showGraphicByDefault,
  showNsfwContent,
  defaultShowComments = false,
  defaultExpanded = false,
  highlightCommentId,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [revealed, setRevealed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const router = useRouter();
  const [deleted, setDeleted] = useState(false);
  const [currentContent, setCurrentContent] = useState(post.content);
  const [wasEdited, setWasEdited] = useState(!!post.editedAt);
  const [currentTags, setCurrentTags] = useState(post.tags ?? []);
  const [editTags, setEditTags] = useState<string[]>(
    post.tags?.map((pt) => pt.tag.name) ?? []
  );
  const [editIsSensitive, setEditIsSensitive] = useState(post.isSensitive);
  const [editIsNsfw, setEditIsNsfw] = useState(post.isNsfw);
  const [editIsGraphicNudity, setEditIsGraphicNudity] = useState(post.isGraphicNudity);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showContentWarnings, setShowContentWarnings] = useState(
    post.isSensitive || post.isNsfw || post.isGraphicNudity
  );
  const menuRef = useRef<HTMLDivElement>(null);

  const isAuthor = currentUserId === post.author?.id;
  const isAuthenticated = !!currentUserId;

  const [, editAction, editPending] = useActionState(editPost, {
    success: false,
    message: "",
  });

  const [, deleteAction, deletePending] = useActionState(
    async (prevState: { success: boolean; message: string }, formData: FormData) => {
      const result = await deletePost(prevState, formData);
      if (result.success) setDeleted(true);
      return result;
    },
    { success: false, message: "" }
  );

  const [isPinned, setIsPinned] = useState(post.isPinned);
  const [, pinAction, pinPending] = useActionState(
    async (prevState: { success: boolean; message: string }, formData: FormData) => {
      const result = await togglePinPost(prevState, formData);
      if (result.success) setIsPinned((prev) => !prev);
      return result;
    },
    { success: false, message: "" }
  );

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showMenu]);

  if (deleted) return null;

  if (post.isAuthorDeleted) {
    return (
      <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900" data-testid="deleted-user-post">
        <div className="flex items-center justify-center px-4 py-8">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">
            This post is from a user who deleted their account
          </p>
        </div>
      </div>
    );
  }

  const authorName =
    post.author?.displayName || post.author?.name || "Anonymous";
  const authorInitial = authorName[0].toUpperCase();
  const avatarSrc = post.author?.avatar || post.author?.image;

  const isRestricted = post.isSensitive || post.isNsfw || post.isGraphicNudity;

  // Determine if content should be hidden
  let showOverlay = false;
  let overlayMessage = "";
  let canReveal = false;

  // Client-side safety net: hide all flagged content from logged-out users
  if (isRestricted && !isAuthenticated) return null;

  if (isRestricted && !revealed) {
    // Sensitive: requires biometric verification
    if (post.isSensitive) {
      if (!biometricVerified) {
        showOverlay = true;
        overlayMessage = "Verify your age to view this content.";
        canReveal = false;
      } else {
        showOverlay = true;
        overlayMessage = "Click to view sensitive content";
        canReveal = true;
      }
    }

    // Graphic/Explicit: requires biometric verification
    if (post.isGraphicNudity) {
      if (!biometricVerified) {
        showOverlay = true;
        overlayMessage = "Verify your age to view this content.";
        canReveal = false;
      } else if (!showGraphicByDefault) {
        showOverlay = true;
        overlayMessage = "Click to view graphic content";
        canReveal = true;
      }
    }

    // NSFW (new tier): available to all logged-in users
    if (post.isNsfw && !showOverlay) {
      if (!showNsfwContent) {
        showOverlay = true;
        overlayMessage = "Click to view NSFW content";
        canReveal = true;
      }
    }
  }

  // Build badge from active flags
  const badges: string[] = [];
  if (post.isSensitive) badges.push("Sensitive");
  if (post.isNsfw) badges.push("NSFW");
  if (post.isGraphicNudity) badges.push("Graphic/Explicit");
  const badge = badges.join(" / ");

  async function handleEditSubmit(formData: FormData) {
    const result = await editPost({ success: false, message: "" }, formData);
    if (result.success) {
      setCurrentContent(formData.get("content") as string);
      setCurrentTags(editTags.map((name) => ({ tag: { name } })));
      setWasEdited(true);
      setIsEditing(false);
      clearDraft(`edit-post-${post.id}`);
    }
  }

  return (
    <div className="rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
      {/* Pinned indicator */}
      {isPinned && (
        <div
          className="flex items-center gap-1.5 px-4 pt-3 pb-0 text-xs font-medium text-zinc-400"
          data-testid="post-pinned-indicator"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M9.828.722a.5.5 0 01.354.146l4.95 4.95a.5.5 0 010 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 01.16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 01-.707 0l-2.829-2.828-3.182 3.182a.5.5 0 11-.707-.708l3.182-3.182L2.398 8.243a.5.5 0 010-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 011.013.16l3.134-3.133a3 3 0 01-.04-.461c0-.43.109-1.022.589-1.503a.5.5 0 01.353-.146z" />
          </svg>
          Pinned
        </div>
      )}
      {/* Author header — always visible */}
      <div className="flex items-center gap-3 px-4 pt-4">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt=""
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-sm font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {authorInitial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {post.author?.username ? (
                <Link
                  href={`/${post.author.username}`}
                  className="hover:underline"
                >
                  {authorName}
                </Link>
              ) : (
                authorName
              )}
            </span>
            {post.author?.username && (
              <Link
                href={`/${post.author.username}`}
                className="truncate text-sm text-zinc-500 hover:underline"
              >
                @{post.author.username}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/post/${post.id}`}
              className="text-xs text-zinc-400 hover:underline"
            >
              {timeAgo(new Date(post.createdAt))}
            </Link>
            {wasEdited && (
              <span className="text-xs text-zinc-400">(edited)</span>
            )}
            {badge && (
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                {badge}
              </span>
            )}
          </div>
        </div>

        {/* Author menu */}
        {isAuthor && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              data-testid="post-menu-button"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditTags(currentTags.map((pt) => pt.tag.name));
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  data-testid="post-edit-button"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRevisionHistory(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  data-testid="post-revision-history-button"
                >
                  Revision history
                </button>
                <form action={pinAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button
                    type="submit"
                    disabled={pinPending}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    data-testid="post-pin-button"
                  >
                    {isPinned ? "Unpin" : "Pin to profile"}
                  </button>
                </form>
                <form action={deleteAction}>
                  <input type="hidden" name="postId" value={post.id} />
                  <button
                    type="submit"
                    disabled={deletePending}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-zinc-700"
                    data-testid="post-delete-button"
                  >
                    Delete
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {showOverlay ? (
        <div className="px-4 py-6">
          <div className="flex flex-col items-center justify-center rounded-lg bg-zinc-100 py-8 dark:bg-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {overlayMessage}
            </p>
            {canReveal && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Show content
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Post content */}
          <div className="px-4 py-3">
            {isEditing ? (
              <form action={handleEditSubmit}>
                <input type="hidden" name="postId" value={post.id} />
                <input type="hidden" name="isSensitive" value={editIsSensitive ? "true" : "false"} />
                <input type="hidden" name="isNsfw" value={editIsNsfw ? "true" : "false"} />
                <input type="hidden" name="isGraphicNudity" value={editIsGraphicNudity ? "true" : "false"} />
                <div data-testid="post-edit-editor">
                  <Editor
                    initialContent={currentContent}
                    inputName="content"
                    placeholder="Edit your post..."
                    minHeight="80px"
                    draftKey={`edit-post-${post.id}`}
                  />
                </div>
                <div className="mt-2">
                  <TagInput
                    tags={editTags}
                    onChange={setEditTags}
                    disabled={editIsSensitive || editIsGraphicNudity}
                    includeNsfw={editIsNsfw}
                  />
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowContentWarnings(!showContentWarnings)}
                    className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                  >
                    <svg className={`h-3.5 w-3.5 transition-transform ${showContentWarnings ? "rotate-90" : ""}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                    Content Warnings
                  </button>
                  {showContentWarnings && (
                    <div className="mt-2 flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={editIsSensitive}
                          onChange={(e) => setEditIsSensitive(e.target.checked)}
                        />
                        Sensitive
                      </label>
                      <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={editIsNsfw}
                          onChange={(e) => setEditIsNsfw(e.target.checked)}
                        />
                        NSFW
                      </label>
                      <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={editIsGraphicNudity}
                          onChange={(e) => setEditIsGraphicNudity(e.target.checked)}
                        />
                        Graphic/Explicit
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowInfoModal(true)}
                        className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                        title="Content flag guidelines"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" />
                          <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={editPending}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    data-testid="post-edit-save"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    data-testid="post-edit-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <PostContent
                content={currentContent}
                truncate={!defaultExpanded}
                allowChecklistToggle={isAuthor}
                onContentChange={(json) => {
                  setCurrentContent(json);
                  updatePostChecklist(post.id, json);
                }}
              />
            )}
          </div>

          {/* Tags */}
          {currentTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2" data-testid="post-tags">
              {currentTags.map((pt) => (
                <Link
                  key={pt.tag.name}
                  href={`/tag/${pt.tag.name}`}
                  className="inline-block rounded-full bg-fuchsia-50 px-2.5 py-0.5 text-xs font-medium text-fuchsia-600 transition-colors hover:bg-fuchsia-100 dark:bg-fuchsia-950/30 dark:text-fuchsia-400 dark:hover:bg-fuchsia-900/40"
                >
                  #{pt.tag.name}
                </Link>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="border-t border-zinc-100 px-2 py-1 dark:border-zinc-800">
            <PostActions
              postId={post.id}
              likeCount={post._count.likes}
              commentCount={post._count.comments}
              repostCount={post._count.reposts}
              bookmarkCount={post._count.bookmarks}
              isLiked={post.likes.length > 0}
              isBookmarked={post.bookmarks.length > 0}
              isReposted={post.reposts.length > 0}
              onToggleComments={() => setShowComments((prev) => !prev)}
              onQuotePost={isAuthenticated ? () => router.push(`/post/${post.id}/quote`) : undefined}
              readOnly={!isAuthenticated}
            />
          </div>

          {/* Comments */}
          {showComments && (
            <CommentSection
              postId={post.id}
              comments={post.comments}
              phoneVerified={phoneVerified}
              isAuthenticated={isAuthenticated}
              highlightCommentId={highlightCommentId}
            />
          )}
        </>
      )}

      {/* Revision history modal */}
      {showRevisionHistory && (
        <PostRevisionHistory
          postId={post.id}
          onClose={() => setShowRevisionHistory(false)}
          onRestore={(content) => {
            setCurrentContent(content);
            setWasEdited(true);
          }}
        />
      )}

      {/* Content flags info modal */}
      {showInfoModal && (
        <ContentFlagsInfoModal onClose={() => setShowInfoModal(false)} />
      )}
    </div>
  );
}
