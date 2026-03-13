import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { cached, cacheKeys } from "@/lib/cache";
import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { FollowButton } from "@/components/follow-button";
import { FriendButton } from "@/components/friend-button";
import { SubscribeButton } from "@/components/subscribe-button";
import { getFriendshipStatus } from "@/app/feed/friend-actions";
import type { FriendshipStatus } from "@/app/feed/friend-actions";
import { isSubscribedToUser } from "@/app/feed/subscription-actions";
import { ProfileShareButton } from "@/components/profile-share-button";
import { BioContent } from "@/components/bio-content";
import { ProfileTabs } from "@/components/profile-tabs";
import { RepostCard } from "@/components/repost-card";
import { generateAdaptiveTheme } from "@/lib/profile-themes";
import { buildMetadata, truncateText, SITE_NAME } from "@/lib/metadata";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await cached(
    cacheKeys.userProfile(username),
    () => prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        displayName: true,
        name: true,
        bio: true,
        avatar: true,
        image: true,
        _count: { select: { followers: true, posts: true } },
      },
    }),
    120
  );

  if (!user) return { title: "User Not Found" };

  const displayName = user.displayName || user.name || user.username;
  const description = user.bio
    ? truncateText(user.bio, 160)
    : `${displayName} (@${user.username}) on ${SITE_NAME}. ${user._count.posts} posts, ${user._count.followers} followers.`;
  const avatarUrl = user.avatar || user.image || undefined;

  return buildMetadata({
    title: `${displayName} (@${user.username})`,
    description,
    path: `/${user.username}`,
    images: avatarUrl ? [{ url: avatarUrl, alt: `${displayName}'s avatar` }] : undefined,
  });
}

export default async function PublicProfilePage({ params, searchParams }: ProfilePageProps) {
  const { username } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "reposts" ? "reposts" as const
    : tab === "sensitive" ? "sensitive" as const
    : tab === "nsfw" ? "nsfw" as const
    : tab === "graphic" ? "graphic" as const
    : "posts" as const;

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
        isProfilePublic: true,
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

  // Check if profile owner has content of each sensitivity type (for tab visibility)
  const [hasSensitivePosts, hasNsfwPosts, hasGraphicPosts] = await Promise.all([
    prisma.post.count({ where: { authorId: user.id, isSensitive: true }, take: 1 }).then(c => c > 0),
    prisma.post.count({ where: { authorId: user.id, isNsfw: true }, take: 1 }).then(c => c > 0),
    prisma.post.count({ where: { authorId: user.id, isGraphicNudity: true }, take: 1 }).then(c => c > 0),
  ]);

  const session = await auth();
  const currentUserId = session?.user?.id;

  // Redirect unauthenticated visitors if profile is private
  if (!user.isProfilePublic && !currentUserId) redirect("/login");

  const isOwnProfile = currentUserId === user.id;

  // Check if current user follows this profile
  let isFollowing = false;
  let phoneVerified = false;
  let ageVerified = false;
  let showGraphicByDefault = false;
  let showNsfwContent = false;
  let friendshipStatus: FriendshipStatus = "none";
  let friendRequestId: string | undefined;
  let isSubscribed = false;

  if (currentUserId && !isOwnProfile) {
    const [follow, friendship, subscribed] = await Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: currentUserId,
            followingId: user.id,
          },
        },
      }),
      getFriendshipStatus(user.id),
      isSubscribedToUser(user.id),
    ]);
    isFollowing = !!follow;
    friendshipStatus = friendship.status;
    friendRequestId = friendship.requestId;
    isSubscribed = subscribed;
  }

  if (currentUserId) {
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { phoneVerified: true, ageVerified: true, showGraphicByDefault: true, showNsfwContent: true },
    });
    phoneVerified = !!currentUser?.phoneVerified;
    ageVerified = !!currentUser?.ageVerified;
    showGraphicByDefault = currentUser?.showGraphicByDefault ?? false;
    showNsfwContent = currentUser?.showNsfwContent ?? false;
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
      where: { parentId: null },
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
        replies: {
          orderBy: { createdAt: "asc" as const },
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
    tags: { include: { tag: { select: { name: true } } } },
    _count: {
      select: {
        likes: true,
        bookmarks: true,
        comments: true,
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
  };

  // Build content flag filter for logged-out users
  const loggedOutFilter = !currentUserId
    ? { isSensitive: false, isNsfw: false, isGraphicNudity: false }
    : {};

  // Check if viewer can see close-friends-only posts
  let canSeeCloseFriends = isOwnProfile;
  if (!canSeeCloseFriends && currentUserId) {
    const closeFriendEntry = await prisma.closeFriend.findUnique({
      where: { userId_friendId: { userId: user.id, friendId: currentUserId } },
    });
    canSeeCloseFriends = !!closeFriendEntry;
  }
  const closeFriendsFilter = canSeeCloseFriends ? {} : { isCloseFriendsOnly: false };

  // Fetch user's posts or reposts based on active tab
  const posts = activeTab === "posts"
    ? await prisma.post.findMany({
        where: {
          authorId: user.id,
          ...loggedOutFilter,
          ...closeFriendsFilter,
          // Flagged posts go to their own tabs
          ...(currentUserId ? { isSensitive: false, isNsfw: false, isGraphicNudity: false } : {}),
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 20,
        include: postInclude,
      })
    : [];

  // Quote reposts (with content) also appear on the Posts tab
  const quoteReposts = activeTab === "posts"
    ? await prisma.repost.findMany({
        where: { userId: user.id, content: { not: null }, ...closeFriendsFilter },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 20,
        include: repostInclude,
      })
    : [];

  const userReposts = activeTab === "reposts"
    ? await prisma.repost.findMany({
        where: { userId: user.id, ...closeFriendsFilter },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: repostInclude,
      })
    : [];

  // Sensitive tab: only isSensitive posts, only for logged-in users
  const sensitivePosts = activeTab === "sensitive" && currentUserId
    ? await prisma.post.findMany({
        where: { authorId: user.id, isSensitive: true, ...closeFriendsFilter },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: postInclude,
      })
    : [];

  // NSFW tab: only isNsfw posts, only for logged-in users
  const nsfwPosts = activeTab === "nsfw" && currentUserId
    ? await prisma.post.findMany({
        where: { authorId: user.id, isNsfw: true, ...closeFriendsFilter },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: postInclude,
      })
    : [];

  // Graphic/Explicit tab: only isGraphicNudity posts, only for logged-in users
  const graphicPosts = activeTab === "graphic" && currentUserId
    ? await prisma.post.findMany({
        where: { authorId: user.id, isGraphicNudity: true, ...closeFriendsFilter },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: postInclude,
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
        // Pinned posts/reposts always come first
        const aPinned = (a.type === "post" && a.data.isPinned) || (a.type === "repost" && a.data.isPinned) ? 1 : 0;
        const bPinned = (b.type === "post" && b.data.isPinned) || (b.type === "repost" && b.data.isPinned) ? 1 : 0;
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

                <div className="flex flex-wrap items-center gap-2">
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
                    <>
                      <FollowButton userId={user.id} isFollowing={isFollowing} />
                      <FriendButton userId={user.id} friendshipStatus={friendshipStatus} requestId={friendRequestId} />
                      <SubscribeButton userId={user.id} isSubscribed={isSubscribed} />
                    </>
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

        <ProfileTabs username={user.username!} activeTab={activeTab} hasCustomTheme={hasCustomTheme} showSensitiveTab={hasSensitivePosts} showNsfwTab={hasNsfwPosts} showGraphicTab={hasGraphicPosts} />

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
                  <PostCard key={item.data.id} post={item.data} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator />
                ) : (
                  <RepostCard key={item.data.id} repost={item.data} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator />
                )
              )}
            </div>
          )
        ) : activeTab === "sensitive" ? (
          !currentUserId ? (
            <div className="mt-8 text-center">
              <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                Log in to view sensitive content.
              </p>
            </div>
          ) : sensitivePosts.length === 0 ? (
            <div className="mt-8 text-center">
              <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                No sensitive posts.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {sensitivePosts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator />
              ))}
            </div>
          )
        ) : activeTab === "nsfw" ? (
          !currentUserId ? (
            <div className="mt-8 text-center">
              <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                Log in to view NSFW content.
              </p>
            </div>
          ) : nsfwPosts.length === 0 ? (
            <div className="mt-8 text-center">
              <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                No NSFW posts.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {nsfwPosts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator />
              ))}
            </div>
          )
        ) : activeTab === "graphic" ? (
          !currentUserId ? (
            <div className="mt-8 text-center">
              <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                Log in to view graphic/explicit content.
              </p>
            </div>
          ) : graphicPosts.length === 0 ? (
            <div className="mt-8 text-center">
              <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                No graphic/explicit posts.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {graphicPosts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator />
              ))}
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
                <RepostCard key={repost.id} repost={repost} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator />
              ))}
            </div>
          )
        )}
      </main>
    </div>
  );
}
