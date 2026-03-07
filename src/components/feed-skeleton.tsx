function PostSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-lg dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-1.5">
          <div className="h-4 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="mt-4 flex gap-6">
        <div className="h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

function ComposerSkeleton() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-lg dark:bg-zinc-900">
      <div className="h-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 flex justify-end">
        <div className="h-9 w-20 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="space-y-4">
      <ComposerSkeleton />
      <div className="mt-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
