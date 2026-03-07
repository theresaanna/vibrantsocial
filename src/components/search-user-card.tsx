import Link from "next/link";

interface SearchUserCardProps {
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
    name: string | null;
    avatar: string | null;
    image: string | null;
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
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={displayName}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {displayName[0]?.toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            {displayName}
          </span>
          {user.username && (
            <span className="truncate text-sm text-zinc-500">
              @{user.username}
            </span>
          )}
        </div>
        {user.bio && (
          <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
            {user.bio}
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
