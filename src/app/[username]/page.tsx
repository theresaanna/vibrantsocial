import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { cached, cacheKeys } from "@/lib/cache";
import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { FollowButton } from "@/components/follow-button";
import { ProfileShareButton } from "@/components/profile-share-button";
import { BioContent } from "@/components/bio-content";
import { ProfileTabs } from "@/components/profile-tabs";
import { RepostCard } from "@/components/repost-card";
import { generateAdaptiveTheme } from "@/lib/profile-themes";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function PublicProfilePage({ params, searchParams }: ProfilePageProps) {
  const { username } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "reposts" ? "reposts" as const : "posts" as const;

  const user = await cached(
    cacheKeys.userProfile(username),
    () => prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        name: true,
        image: true,
        avatar: true,
        bio: true,
        profileBgColor: true,
        profileTextColor: true,
        profileLinkColor: true,
        profileSecondaryColor: true,
        profileContainerColor: true,
        _count: {
          select: {
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    }),
    120 // cache for 2 minutes
  );

  if (!user) notFound();

  const session = await auth();
  const currentUserId = session?.user?.id;
  const isOwnProfile = currentUserId === user.id;

  // Check if current user follows this profile
  let isFollowing = false;
  let phoneVerified = false;
  let biometricVerified = false;
  let showNsfwByDefault = false;

  if (currentUserId && !isOwnProfile) {
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentUserId,
          followingId: user.id,
        },
      },
    });
    isFollowing = !!follow;
  }

  if (currentUserId) {
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { phoneVerified: true, biometricVerified: true, showNsfwByDefault: true },
    });
    phoneVerified = !!currentUser?.phoneVerified;
    biometricVerified = !!currentUser?.biometricVerified;
    showNsfwByDefault = currentUser?.showNsfwByDefault ?? false;
  }

  const postInclude = {
    author: {
      select: {
        id: true,
        username: true,
        displayName: true,
        name: true,
        image: true,
        avatar: true,
      },
    },
    _count: {
      select: {
        comments: true,
        likes: true,
        bookmarks: true,
        reposts: true,
      },
    },
    likes: {
      where: { userId: currentUserId ?? "" },
      select: { id: true },
    },
    bookmarks: {
      where: { userId: currentUserId ?? "" },
      select: { id: true },
    },
    reposts: {
      where: { userId: currentUserId ?? "" },
      select: { id: true },
    },
    tags: {
      include: {
        tag: {
          select: { name: true },
        },
      },
    },
    comments: {
      orderBy: { createdAt: "asc" as const },
      take: 5,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            name: true,
            image: true,
            avatar: true,
          },
        },
      },
    },
  };

  const repostInclude = {
    user: {
      select: {
        id: true,
        username: true,
        displayName: true,
        name: true,
        image: true,
        avatar: true,
      },
    },
    post: { include: postInclude },
  };

  // Fetch user's posts or reposts based on active tab
  const posts = activeTab === "posts"
    ? await prisma.post.findMany({
        where: { authorId: user.id },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 20,
        include: postInclude,
      })
    : [];

  // Quote reposts (with content) also appear on the Posts tab
  const quoteReposts = activeTab === "posts"
    ? await prisma.repost.findMany({
        where: { userId: user.id, content: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: repostInclude,
      })
    : [];

  const userReposts = activeTab === "reposts"
    ? await prisma.repost.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: repostInclude,
      })
    : [];

  // Merge posts and quote reposts chronologically for the Posts tab
  type FeedItem =
    | { type: "post"; data: (typeof posts)[number]; date: Date }
    | { type: "repost"; data: (typeof quoteReposts)[number]; date: Date };

  const feedItems: FeedItem[] = activeTab === "posts"
    ? [
        ...posts.map((p) => ({ type: "post" as const, data: p, date: p.createdAt })),
        ...quoteReposts.map((r) => ({ type: "repost" as const, data: r, date: r.createdAt })),
      ].sort((a, b) => {
        // Pinned posts always come first
        const aPinned = a.type === "post" && a.data.isPinned ? 1 : 0;
        const bPinned = b.type === "post" && b.data.isPinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return b.date.getTime() - a.date.getTime();
      })
    : [];

  const displayName = user.displayName || user.name || user.username;
  const avatarSrc = user.avatar || user.image;
  const initial = (displayName || "?")[0].toUpperCase();

  const hasCustomTheme = !!(
    user.profileBgColor ||
    user.profileTextColor ||
    user.profileLinkColor ||
    user.profileSecondaryColor ||
    user.profileContainerColor
  );

  const themeStyle = hasCustomTheme
    ? (() => {
        const userColors = {
          profileBgColor: user.profileBgColor ?? "#ffffff",
          profileTextColor: user.profileTextColor ?? "#18181b",
          profileLinkColor: user.profileLinkColor ?? "#2563eb",
          profileSecondaryColor: user.profileSecondaryColor ?? "#71717a",
          profileContainerColor: user.profileContainerColor ?? "#f4f4f5",
        };
        const { light, dark } = generateAdaptiveTheme(userColors);
        return {
          "--profile-bg-light": light.profileBgColor,
          "--profile-text-light": light.profileTextColor,
          "--profile-link-light": light.profileLinkColor,
          "--profile-secondary-light": light.profileSecondaryColor,
          "--profile-container-light": light.profileContainerColor,
          "--profile-bg-dark": dark.profileBgColor,
          "--profile-text-dark": dark.profileTextColor,
          "--profile-link-dark": dark.profileLinkColor,
          "--profile-secondary-dark": dark.profileSecondaryColor,
          "--profile-container-dark": dark.profileContainerColor,
        } as React.CSSProperties;
      })()
    : undefined;

  return (
    <div className={hasCustomTheme ? "profile-themed" : ""} style={themeStyle}>
      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Profile header */}
        <div className={`rounded-2xl p-6 shadow-lg ${hasCustomTheme ? "profile-container" : "bg-white dark:bg-zinc-900"}`}>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                referrerPolicy="no-referrer"
                className="h-16 w-16 shrink-0 rounded-full"
              />
            ) : (
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold ${hasCustomTheme ? "profile-container" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"}`}>
                {initial}
              </div>
            )}

            <div className="min-w-0 w-full sm:flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <h1 className={`text-xl font-bold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                    {displayName}
                  </h1>
                  <p className={`text-sm ${hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}`}>
                    @{user.username}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {isOwnProfile && (
                    <Link
                      href="/profile"
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                        hasCustomTheme
                          ? "profile-share-btn"
                          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      }`}
                      style={
                        hasCustomTheme
                          ? ({
                              borderColor: "var(--profile-secondary)",
                              color: "var(--profile-text)",
                            } as React.CSSProperties)
                          : undefined
                      }
                    >
                      Edit Profile
                    </Link>
                  )}
                  {currentUserId && !isOwnProfile && (
                    <FollowButton userId={user.id} isFollowing={isFollowing} />
                  )}
                  <ProfileShareButton username={user.username!} hasCustomTheme={hasCustomTheme} />
                </div>
              </div>

              {user.bio && (
                <div className="mt-2">
                  <BioContent content={user.bio} />
                </div>
              )}

              <div className="mt-3 flex gap-4 text-sm">
                <span className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                  <span className={`font-semibold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                    {user._count.posts}
                  </span>{" "}
                  posts
                </span>
                {currentUserId ? (
                  <Link href={`/${user.username}/followers`} className={`hover:underline ${hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}`}>
                    <span className={`font-semibold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {user._count.followers}
                    </span>{" "}
                    followers
                  </Link>
                ) : (
                  <span className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                    <span className={`font-semibold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {user._count.followers}
                    </span>{" "}
                    followers
                  </span>
                )}
                {currentUserId ? (
                  <Link href={`/${user.username}/following`} className={`hover:underline ${hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}`}>
                    <span className={`font-semibold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {user._count.following}
                    </span>{" "}
                    following
                  </Link>
                ) : (
                  <span className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                    <span className={`font-semibold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {user._count.following}
                    </span>{" "}
                    following
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <ProfileTabs username={user.username!} activeTab={activeTab} hasCustomTheme={hasCustomTheme} />

        {/* Tab content */}
        {activeTab === "posts" ? (
          feedItems.length === 0 ? (
            <div className="mt-8 text-center">
              <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                No posts yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {feedItems.map((item) =>
                item.type === "post" ? (
                  <PostCard key={item.data.id} post={item.data} currentUserId={currentUserId} phoneVerified={phoneVerified} biometricVerified={biometricVerified} showNsfwByDefault={showNsfwByDefault} />
                ) : (
                  <RepostCard key={item.data.id} repost={item.data} currentUserId={currentUserId} phoneVerified={phoneVerified} biometricVerified={biometricVerified} showNsfwByDefault={showNsfwByDefault} />
                )
              )}
            </div>
          )
        ) : (
          userReposts.length === 0 ? (
            <div className="mt-8 text-center">
              <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                No reposts yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {userReposts.map((repost) => (
                <RepostCard key={repost.id} repost={repost} currentUserId={currentUserId} phoneVerified={phoneVerified} biometricVerified={biometricVerified} showNsfwByDefault={showNsfwByDefault} />
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
