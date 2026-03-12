"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import { PostCard } from "./post-card";
import { EditorContent } from "@/components/editor/EditorContent";
import { Editor } from "./editor/Editor";
import { clearDraft } from "./editor/plugins/DraftPlugin";
import { TagInput } from "./tag-input";
import { ContentFlagsInfoModal } from "./content-flags-info-modal";
import { editRepost, deleteRepost, togglePinRepost } from "@/app/feed/post-actions";
import { QuotePostActions } from "./quote-post-actions";
import { RepostCommentSection } from "./repost-comment-section";
import { timeAgo } from "@/lib/time";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface RepostUser {
  id: string;
  username: string | null;
  displayName: string | null;
  name: string | null;
  image: string | null;
  avatar: string | null;
}

interface RepostCardProps {
  repost: {
    id: string;
    content: string | null;
    createdAt: Date;
    editedAt?: Date | null;
    isPinned?: boolean;
    isSensitive?: boolean;
    isNsfw?: boolean;
    isGraphicNudity?: boolean;
    isCloseFriendsOnly?: boolean;
    tags?: Array<{ tag: { name: string } }>;
    user: RepostUser;
    _count?: {
      likes: number;
      bookmarks: number;
      comments: number;
    };
    likes?: Array<{ id: string }>;
    bookmarks?: Array<{ id: string }>;
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
      author: RepostUser | null;
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
      comments: Array<{
        id: string;
        content: string;
        createdAt: Date;
        author: RepostUser;
      }>;
    };
  };
  currentUserId?: string;
  phoneVerified: boolean;
  ageVerified: boolean;
  showGraphicByDefault: boolean;
  showNsfwContent: boolean;
  showPinnedIndicator?: boolean;
}

export function RepostCard({
  repost,
  currentUserId,
  phoneVerified,
  ageVerified,
  showGraphicByDefault,
  showNsfwContent,
  showPinnedIndicator = false,
}: RepostCardProps) {
  const router = useRouter();
  const reposterName = repost.user.displayName || repost.user.name || repost.user.username;
  const isAuthor = currentUserId === repost.user.id;
  const isQuote = !!repost.content;

  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(repost._count?.comments ?? 0);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [currentContent, setCurrentContent] = useState(repost.content);
  const [wasEdited, setWasEdited] = useState(!!repost.editedAt);
  const [currentTags, setCurrentTags] = useState(repost.tags ?? []);
  const [editTags, setEditTags] = useState<string[]>(
    repost.tags?.map((rt) => rt.tag.name) ?? []
  );
  const [editIsSensitive, setEditIsSensitive] = useState(repost.isSensitive ?? false);
  const [editIsNsfw, setEditIsNsfw] = useState(repost.isNsfw ?? false);
  const [editIsGraphicNudity, setEditIsGraphicNudity] = useState(repost.isGraphicNudity ?? false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showContentWarnings, setShowContentWarnings] = useState(
    (repost.isSensitive || repost.isNsfw || repost.isGraphicNudity) ?? false
  );
  const menuRef = useRef<HTMLDivElement>(null);

  const [, editAction, editPending] = useActionState(editRepost, {
    success: false,
    message: "",
  });

  const [, deleteAction, deletePending] = useActionState(
    async (prevState: { success: boolean; message: string }, formData: FormData) => {
      const result = await deleteRepost(prevState, formData);
      if (result.success) setDeleted(true);
      return result;
    },
    { success: false, message: "" }
  );

  const [isPinned, setIsPinned] = useState(repost.isPinned ?? false);
  const [, pinAction, pinPending] = useActionState(
    async (prevState: { success: boolean; message: string }, formData: FormData) => {
      const result = await togglePinRepost(prevState, formData);
      if (result.success) setIsPinned((prev) => !prev);
      return result;
    },
    { success: false, message: "" }
  );

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  async function handleEditSubmit(formData: FormData) {
    const result = await editRepost({ success: false, message: "" }, formData);
    if (result.success) {
      setCurrentContent(formData.get("content") as string);
      setCurrentTags(editTags.map((name) => ({ tag: { name } })));
      setWasEdited(true);
      setIsEditing(false);
      clearDraft(`edit-repost-${repost.id}`);
    }
  }

  if (deleted) return null;

  // Content flag badges for quote
  const badges: string[] = [];
  if (repost.isSensitive) badges.push("Sensitive");
  if (repost.isNsfw) badges.push("NSFW");
  if (repost.isGraphicNudity) badges.push("Graphic/Explicit");
  const badge = badges.join(" / ");

  return (
    <div>
      {/* Pinned indicator */}
      {isPinned && showPinnedIndicator && (
        <div
          className="flex items-center gap-1.5 pl-2 pb-1 text-xs font-medium text-zinc-400"
          data-testid="repost-pinned-indicator"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M9.828.722a.5.5 0 01.354.146l4.95 4.95a.5.5 0 010 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 01.16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 01-.707 0l-2.829-2.828-3.182 3.182a.5.5 0 11-.707-.708l3.182-3.182L2.398 8.243a.5.5 0 010-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 011.013.16l3.134-3.133a3 3 0 01-.04-.461c0-.43.109-1.022.589-1.503a.5.5 0 01.353-.146z" />
          </svg>
          Pinned
        </div>
      )}

      {/* Repost header */}
      <div className="mb-1 flex items-center gap-1.5 pl-2 text-xs text-zinc-500 dark:text-zinc-400">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
        </svg>
        <Link href={`/${repost.user.username}`} className="font-medium hover:underline">
          {reposterName}
        </Link>
        <span>{isQuote ? "quoted" : "reposted"}</span>
        {isQuote ? (
          <Link href={`/quote/${repost.id}`} className="text-zinc-400 hover:underline dark:text-zinc-500">
            {timeAgo(repost.createdAt)}
          </Link>
        ) : (
          <span className="text-zinc-400 dark:text-zinc-500">{timeAgo(repost.createdAt)}</span>
        )}
        {wasEdited && (
          <span className="text-zinc-400 dark:text-zinc-500">(edited)</span>
        )}
        {badge && (
          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {badge}
          </span>
        )}
        {repost.isCloseFriendsOnly && (
          <span className="flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-600 dark:bg-green-900/30 dark:text-green-400" title="Close friends only">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </span>
        )}

        {/* Author menu for quote posts */}
        {isAuthor && isQuote && (
          <div className="relative ml-auto" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu((prev) => !prev)}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              data-testid="repost-menu-button"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setEditTags(currentTags.map((rt) => rt.tag.name));
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  data-testid="repost-edit-button"
                >
                  Edit
                </button>
                <form action={pinAction}>
                  <input type="hidden" name="repostId" value={repost.id} />
                  <button
                    type="submit"
                    disabled={pinPending}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    data-testid="repost-pin-button"
                  >
                    {isPinned ? "Unpin" : "Pin to profile"}
                  </button>
                </form>
                <form action={deleteAction}>
                  <input type="hidden" name="repostId" value={repost.id} />
                  <button
                    type="submit"
                    disabled={deletePending}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-zinc-700"
                    data-testid="repost-delete-button"
                  >
                    Delete
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {isQuote ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700">
          {/* Quote content */}
          <div className="bg-zinc-50 px-4 py-3 dark:bg-zinc-800/50">
            {isEditing ? (
              <form action={handleEditSubmit}>
                <input type="hidden" name="repostId" value={repost.id} />
                <input type="hidden" name="isSensitive" value={editIsSensitive ? "true" : "false"} />
                <input type="hidden" name="isNsfw" value={editIsNsfw ? "true" : "false"} />
                <input type="hidden" name="isGraphicNudity" value={editIsGraphicNudity ? "true" : "false"} />
                <div data-testid="repost-edit-editor">
                  <Editor
                    initialContent={currentContent || undefined}
                    inputName="content"
                    placeholder="Edit your quote..."
                    minHeight="60px"
                    draftKey={`edit-repost-${repost.id}`}
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
                    data-testid="repost-edit-save"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    data-testid="repost-edit-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <EditorContent content={currentContent!} />
            )}
          </div>

          {/* Tags */}
          {!isEditing && currentTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 bg-zinc-50 px-4 pb-3 dark:bg-zinc-800/50">
              {currentTags.map((rt) => (
                <Link
                  key={rt.tag.name}
                  href={`/tag/${rt.tag.name}`}
                  className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                >
                  #{rt.tag.name}
                </Link>
              ))}
            </div>
          )}

          {/* Quote interaction bar */}
          {!isEditing && (
            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-1.5 dark:border-zinc-700 dark:bg-zinc-800/50">
              <QuotePostActions
                repostId={repost.id}
                postId={repost.post.id}
                likeCount={repost._count?.likes ?? 0}
                commentCount={commentCount}
                bookmarkCount={repost._count?.bookmarks ?? 0}
                isLiked={(repost.likes?.length ?? 0) > 0}
                isBookmarked={(repost.bookmarks?.length ?? 0) > 0}
                onToggleComments={() => setShowComments((v) => !v)}
                onQuotePost={currentUserId ? () => router.push(`/post/${repost.post.id}/quote`) : undefined}
                readOnly={!currentUserId}
              />
            </div>
          )}

          {/* Quote comments */}
          {showComments && isQuote && (
            <div className="bg-zinc-50 dark:bg-zinc-800/50">
              <RepostCommentSection
                repostId={repost.id}
                phoneVerified={phoneVerified}
                isAuthenticated={!!currentUserId}
                onCommentCountChange={setCommentCount}
              />
            </div>
          )}

          {/* Original post */}
          <PostCard
            post={repost.post}
            currentUserId={currentUserId}
            phoneVerified={phoneVerified}
            ageVerified={ageVerified}
            showGraphicByDefault={showGraphicByDefault}
            showNsfwContent={showNsfwContent}
          />
        </div>
      ) : (
        <PostCard
          post={repost.post}
          currentUserId={currentUserId}
          phoneVerified={phoneVerified}
          ageVerified={ageVerified}
          showGraphicByDefault={showGraphicByDefault}
          showNsfwContent={showNsfwContent}
        />
      )}

      {showInfoModal && <ContentFlagsInfoModal onClose={() => setShowInfoModal(false)} />}
    </div>
  );
}
