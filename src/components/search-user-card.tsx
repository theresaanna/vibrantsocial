import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { extractTextFromLexicalJson } from "@/lib/lexical-text";
import { StyledName } from "@/components/styled-name";
import { LinkifyText } from "@/components/chat/linkify-text";

interface SearchUserCardProps {
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    avatar: string | null;
    image: string | null;
    profileFrameId: string | null;
    usernameFont?: string | null;
    bio: string | null;
    _count: { followers: number; posts: number };
  };
}

export function SearchUserCard({ user }: SearchUserCardProps) {
  const avatarSrc = user.avatar || user.image;
  const displayName = user.displayName || user.name || user.username || "User";
  const href = user.username ? `/${user.username}` : "#";

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <FramedAvatar src={avatarSrc} alt={displayName} initial={displayName[0]?.toUpperCase()} size={60} frameId={user.profileFrameId} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            <StyledName fontId={user.usernameFont}>{displayName}</StyledName>
          </span>
          {user.username && (
            <span className="truncate text-sm text-zinc-500">
              @{user.username}
            </span>
          )}
        </div>
        {user.bio && (
          <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            <LinkifyText text={extractTextFromLexicalJson(user.bio)} asSpans />
          </p>
        )}
        <div className="mt-1 flex gap-3 text-xs text-zinc-400">
          <span>
            {user._count.followers}{" "}
            {user._count.followers === 1 ? "follower" : "followers"}
          </span>
          <span>
            {user._count.posts} {user._count.posts === 1 ? "post" : "posts"}
          </span>
        </div>
      </div>
    </Link>
  );
}
