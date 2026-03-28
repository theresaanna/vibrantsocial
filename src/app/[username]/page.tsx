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
import { getFriendshipStatus, getFriendsCount } from "@/app/feed/friend-actions";
import type { FriendshipStatus } from "@/app/feed/friend-actions";
import { isSubscribedToUser } from "@/app/feed/subscription-actions";
import { ProfileShareButton } from "@/components/profile-share-button";
import { FramedAvatar } from "@/components/framed-avatar";
import { BioContent } from "@/components/bio-content";
import { ProfileTabs } from "@/components/profile-tabs";
import { RepostCard } from "@/components/repost-card";
import { ReportButton } from "@/components/report-button";
import { BlockButton } from "@/components/block-button";
import { MessageButton } from "@/components/message-button";
import { ChatRequestButton } from "@/components/chat-request-button";
import { getChatRequestStatus, type ChatRequestStatus } from "@/app/chat/actions";
import { getBlockStatus } from "@/app/feed/block-actions";
import { generateAdaptiveTheme } from "@/lib/profile-themes";
import { buildMetadata, truncateText, SITE_NAME } from "@/lib/metadata";
import { extractTextFromLexicalJson } from "@/lib/lexical-text";
import { buildProfilePostsContentFilter } from "./profile-queries";
import { MarketplaceGrid } from "@/components/marketplace-grid";
import { fetchUserMarketplacePosts } from "@/app/marketplace/media-actions";
import { fetchUserMediaPosts } from "./media-actions";
import { MediaGrid } from "@/components/media-grid";
import { WallPostComposer } from "@/components/wall-post-composer";
import { getUserListMemberships } from "@/app/lists/actions";
import { AddToListButton } from "@/components/add-to-list-button";
import { PremiumCrown } from "@/components/premium-crown";
import { ProfileSparklefall } from "@/components/profile-sparklefall";
import { isBirthday, getBirthdaySparkleConfig } from "@/lib/birthday";
import { StyledName } from "@/components/styled-name";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  image: true,
  avatar: true,
  profileFrameId: true,
  usernameFont: true,
  bio: true,
  profileBgColor: true,
  profileTextColor: true,
  profileLinkColor: true,
  profileSecondaryColor: true,
  profileContainerColor: true,
  profileBgImage: true,
  profileBgRepeat: true,
  profileBgAttachment: true,
  profileBgSize: true,
  profileBgPosition: true,
  sparklefallEnabled: true,
  sparklefallSparkles: true,
  sparklefallColors: true,
  sparklefallInterval: true,
  sparklefallWind: true,
  sparklefallMaxSparkles: true,
  sparklefallMinSize: true,
  sparklefallMaxSize: true,
  birthdayMonth: true,
  birthdayDay: true,
  isProfilePublic: true,
  hideWallFromFeed: true,
  tier: true,
  phoneVerified: true,
  _count: {
    select: {
      posts: true,
      followers: true,
      following: true,
      userLists: true,
    },
  },
} as const;

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await cached(
    cacheKeys.userProfile(username),
    () => prisma.user.findUnique({
      where: { username },
      select: profileSelect,
    }),
    120
  );

  if (!user) return { title: "User Not Found" };

  const displayName = user.displayName || user.name || user.username;
  const bioText = user.bio ? extractTextFromLexicalJson(user.bio) || user.bio : "";
  const description = bioText
    ? truncateText(bioText, 160)
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
  const activeTab = tab === "media" ? "media" as const
    : tab === "wall" ? "wall" as const
    : tab === "sensitive" ? "sensitive" as const
    : tab === "nsfw" ? "nsfw" as const
    : tab === "graphic" ? "graphic" as const
    : tab === "marketplace" ? "marketplace" as const
    : "posts" as const;

  const user = await cached(
    cacheKeys.userProfile(username),
    () => prisma.user.findUnique({
      where: { username },
      select: profileSelect,
    }),
    120 // cache for 2 minutes
  );

  if (!user) notFound();

  // Check if profile owner has content of each sensitivity type (for tab visibility)
  const [hasSensitivePosts, hasNsfwPosts, hasGraphicPosts, hasMarketplacePosts] = await Promise.all([
    prisma.post.count({ where: { authorId: user.id, isSensitive: true }, take: 1 }).then(c => c > 0),
    prisma.post.count({ where: { authorId: user.id, isNsfw: true }, take: 1 }).then(c => c > 0),
    prisma.post.count({ where: { authorId: user.id, isGraphicNudity: true }, take: 1 }).then(c => c > 0),
    prisma.post.count({ where: { authorId: user.id, marketplacePost: { isNot: null } }, take: 1 }).then(c => c > 0),
  ]);

  // Always show media tab — user has posts with images/videos
  const hasMediaPosts = user._count.posts > 0;

  const session = await auth();
  const currentUserId = session?.user?.id;

  // Redirect unauthenticated visitors if profile is private
  if (!user.isProfilePublic && !currentUserId) redirect("/login");

  const isOwnProfile = currentUserId === user.id;

  // Check block status
  let blockStatus: "none" | "blocked_by_me" | "blocked_by_them" = "none";
  if (currentUserId && !isOwnProfile) {
    blockStatus = await getBlockStatus(user.id);
  }

  // Fetch friends count for all profiles
  const friendsCount = blockStatus === "none" ? await getFriendsCount(user.id) : 0;

  // Check if current user follows this profile
  let isFollowing = false;
  let phoneVerified = false;
  let ageVerified = false;
  let showGraphicByDefault = false;
  let showNsfwContent = false;
  let friendshipStatus: FriendshipStatus = "none";
  let friendRequestId: string | undefined;
  let isSubscribed = false;
  let listMemberships: { id: string; name: string; isMember: boolean }[] = [];
  let chatRequestStatus: ChatRequestStatus = "none";

  if (currentUserId && !isOwnProfile) {
    const [follow, friendship, subscribed, memberships, chatReqStatus] = await Promise.all([
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
      blockStatus === "none" ? getUserListMemberships(user.id) : Promise.resolve([]),
      blockStatus === "none" ? getChatRequestStatus(user.id) : Promise.resolve("none" as ChatRequestStatus),
    ]);
    isFollowing = !!follow;
    friendshipStatus = friendship.status;
    friendRequestId = friendship.requestId;
    isSubscribed = subscribed;
    listMemberships = memberships;
    chatRequestStatus = chatReqStatus;
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
        profileFrameId: true,
        usernameFont: true,
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
    wallPost: {
      select: {
        id: true,
        status: true,
        wallOwner: {
          select: {
            username: true,
            displayName: true,
            usernameFont: true,
          },
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
            profileFrameId: true,
            usernameFont: true,
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
                profileFrameId: true,
                usernameFont: true,
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
        profileFrameId: true,
        usernameFont: true,
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
    ? { isSensitive: false, isNsfw: false, isGraphicNudity: false, isLoggedInOnly: false }
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

  // Build audience visibility filter for custom audience posts
  const audienceFilter = isOwnProfile
    ? {}
    : currentUserId
      ? {
          OR: [
            { hasCustomAudience: false },
            { hasCustomAudience: true, audience: { some: { userId: currentUserId } } },
          ],
        }
      : { hasCustomAudience: false };

  // Fetch user's posts or reposts based on active tab
  const posts = activeTab === "posts"
    ? await prisma.post.findMany({
        where: {
          authorId: user.id,
          ...loggedOutFilter,
          ...closeFriendsFilter,
          ...audienceFilter,
          // Flagged posts go to their own tabs (NSFW shown here when viewer opted in)
          ...buildProfilePostsContentFilter(currentUserId, showNsfwContent),
          // Marketplace posts only show on their own tab unless promoted
          OR: [
            { marketplacePost: null },
            { marketplacePost: { promotedToFeed: true } },
          ],
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 20,
        include: postInclude,
      })
    : [];

  // All reposts appear on the Posts tab
  const allReposts = activeTab === "posts"
    ? await prisma.repost.findMany({
        where: { userId: user.id, ...closeFriendsFilter },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 20,
        include: repostInclude,
      })
    : [];

  // Sensitive tab: only isSensitive posts, only for logged-in users
  const sensitivePosts = activeTab === "sensitive" && currentUserId
    ? await prisma.post.findMany({
        where: { authorId: user.id, isSensitive: true, ...closeFriendsFilter, ...audienceFilter },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: postInclude,
      })
    : [];

  // NSFW tab: only isNsfw posts, only for logged-in users
  const nsfwPosts = activeTab === "nsfw" && currentUserId
    ? await prisma.post.findMany({
        where: { authorId: user.id, isNsfw: true, ...closeFriendsFilter, ...audienceFilter },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: postInclude,
      })
    : [];

  // Graphic/Explicit tab: only isGraphicNudity posts, only for logged-in users
  const graphicPosts = activeTab === "graphic" && currentUserId
    ? await prisma.post.findMany({
        where: { authorId: user.id, isGraphicNudity: true, ...closeFriendsFilter, ...audienceFilter },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: postInclude,
      })
    : [];

  // Wall posts: shown inline in Posts tab (default) or in separate Wall tab (when hideWallFromFeed enabled)
  const isFriend = friendshipStatus === "friends";
  const canSeeWall = isOwnProfile || isFriend;
  const showWallInSeparateTab = user.hideWallFromFeed;
  const showWallOnPostsTab = !showWallInSeparateTab;

  const wallPostStatusFilter = isOwnProfile
    ? { status: { in: ["pending", "accepted"] } }
    : { status: "accepted" };

  const shouldFetchWall = canSeeWall && currentUserId && (
    (activeTab === "posts" && showWallOnPostsTab) ||
    (activeTab === "wall" && showWallInSeparateTab)
  );

  const wallPosts = shouldFetchWall
    ? await prisma.wallPost.findMany({
        where: {
          wallOwnerId: user.id,
          ...wallPostStatusFilter,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          post: {
            include: postInclude,
          },
          wallOwner: {
            select: {
              username: true,
              displayName: true,
              usernameFont: true,
            },
          },
        },
      })
    : [];

  // Merge posts, reposts, and wall posts chronologically
  type FeedItem =
    | { type: "post"; data: (typeof posts)[number]; date: Date }
    | { type: "repost"; data: (typeof allReposts)[number]; date: Date }
    | { type: "wall"; data: (typeof wallPosts)[number]; date: Date };

  const feedItems: FeedItem[] = activeTab === "posts"
    ? [
        ...posts.map((p) => ({ type: "post" as const, data: p, date: p.createdAt })),
        ...allReposts.map((r) => ({ type: "repost" as const, data: r, date: r.createdAt })),
        ...(showWallOnPostsTab ? wallPosts : []).map((wp) => ({ type: "wall" as const, data: wp, date: wp.createdAt })),
      ].sort((a, b) => {
        // Pinned posts/reposts always come first
        const aPinned = (a.type === "post" && a.data.isPinned) || (a.type === "repost" && a.data.isPinned) ? 1 : 0;
        const bPinned = (b.type === "post" && b.data.isPinned) || (b.type === "repost" && b.data.isPinned) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return b.date.getTime() - a.date.getTime();
      })
    : [];

  // Wall tab items (only when wall is shown separately)
  const wallFeedItems: FeedItem[] = activeTab === "wall" && showWallInSeparateTab
    ? wallPosts.map((wp) => ({ type: "wall" as const, data: wp, date: wp.createdAt }))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
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

  const userHasBirthday = isBirthday(user.birthdayMonth, user.birthdayDay);

  const themeStyle = hasCustomTheme
    ? await (async () => {
        const userColors = {
          profileBgColor: user.profileBgColor ?? "#ffffff",
          profileTextColor: user.profileTextColor ?? "#18181b",
          profileLinkColor: user.profileLinkColor ?? "#2563eb",
          profileSecondaryColor: user.profileSecondaryColor ?? "#71717a",
          profileContainerColor: user.profileContainerColor ?? "#f4f4f5",
        };

        // Check if the user's colors match a saved AI-generated preset
        let customPreset: {
          darkBgColor: string;
          darkTextColor: string;
          darkLinkColor: string;
          darkSecondaryColor: string;
          darkContainerColor: string;
        } | null = null;
        try {
          customPreset = await prisma.customThemePreset.findFirst({
            where: {
              userId: user.id,
              lightBgColor: userColors.profileBgColor,
              lightTextColor: userColors.profileTextColor,
              lightLinkColor: userColors.profileLinkColor,
              lightSecondaryColor: userColors.profileSecondaryColor,
              lightContainerColor: userColors.profileContainerColor,
            },
          });
        } catch {
          // Table may not exist yet during migration rollout
        }

        let light = userColors;
        let dark;
        if (customPreset) {
          dark = {
            profileBgColor: customPreset.darkBgColor,
            profileTextColor: customPreset.darkTextColor,
            profileLinkColor: customPreset.darkLinkColor,
            profileSecondaryColor: customPreset.darkSecondaryColor,
            profileContainerColor: customPreset.darkContainerColor,
          };
        } else {
          const adaptive = generateAdaptiveTheme(userColors);
          light = adaptive.light;
          dark = adaptive.dark;
        }

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

  const bgImageStyle: React.CSSProperties | undefined = user.profileBgImage
    ? {
        backgroundImage: `url(${user.profileBgImage})`,
        backgroundRepeat: user.profileBgRepeat ?? "no-repeat",
        backgroundAttachment: user.profileBgAttachment ?? "scroll",
        backgroundSize: user.profileBgSize ?? "cover",
        backgroundPosition: user.profileBgPosition ?? "center",
        minHeight: "calc(100vh - 57px)",
      }
    : undefined;

  return (
    <div
      className={hasCustomTheme ? "profile-themed" : ""}
      style={{ ...themeStyle, ...bgImageStyle }}
    >
      {(() => {
        if (userHasBirthday) {
          const config = getBirthdaySparkleConfig();
          return (
            <ProfileSparklefall
              sparkles={config.sparkles}
              colors={config.colors}
              interval={config.interval}
              wind={config.wind}
              maxSparkles={config.maxSparkles}
              minSize={config.minSize}
              maxSize={config.maxSize}
            />
          );
        }

        if (user.sparklefallEnabled && user.tier === "premium") {
          return (
            <ProfileSparklefall
              sparkles={user.sparklefallSparkles}
              colors={user.sparklefallColors}
              interval={user.sparklefallInterval}
              wind={user.sparklefallWind}
              maxSparkles={user.sparklefallMaxSparkles}
              minSize={user.sparklefallMinSize}
              maxSize={user.sparklefallMaxSize}
            />
          );
        }

        return null;
      })()}
      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Profile header */}
        <div className={`relative rounded-2xl p-6 shadow-lg ${hasCustomTheme ? "profile-container" : "bg-white dark:bg-zinc-900"}`}>
          {/* Block & Report flags — top-right corner, icon only */}
          {currentUserId && !isOwnProfile && blockStatus !== "blocked_by_them" && (
            <div className="absolute top-3 right-3 flex items-center gap-1">
              <BlockButton userId={user.id} isBlocked={blockStatus === "blocked_by_me"} hasVerifiedPhone={!!user.phoneVerified} />
              <ReportButton contentType="profile" contentId={user.id} label="" />
            </div>
          )}

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
            <FramedAvatar
              src={avatarSrc}
              alt=""
              initial={initial}
              size={80}
              frameId={user.profileFrameId}
              referrerPolicy="no-referrer"
            />

            <div className="min-w-0 w-full sm:flex-1">
              <div className="min-w-0">
                <h1
                  className={`text-xl font-bold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}
                  data-testid="profile-display-name"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <StyledName fontId={user.usernameFont}>{displayName}</StyledName>
                    {user.tier === "premium" && (
                      <Link href="/premium" title="Premium member" className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
                        <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </Link>
                    )}
                  </span>
                </h1>
                <p className={`text-sm ${hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}`}>
                  @{user.username}
                </p>
              </div>

              {blockStatus === "blocked_by_me" && (
                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-700 dark:bg-zinc-800">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    You have blocked this user.
                  </p>
                </div>
              )}

              {blockStatus === "blocked_by_them" && (
                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-700 dark:bg-zinc-800">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    This content is unavailable.
                  </p>
                </div>
              )}

              {blockStatus === "none" && user.bio && (
                <div className="mt-2">
                  <BioContent content={user.bio} />
                </div>
              )}

              {blockStatus === "none" && userHasBirthday && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-50 to-purple-50 px-3 py-2 dark:from-pink-950/30 dark:to-purple-950/30" data-testid="birthday-banner">
                  <span className="text-lg">🎂</span>
                  <p className="text-sm font-medium text-pink-700 dark:text-pink-300">
                    Happy birthday, {displayName}!
                  </p>
                </div>
              )}

              {blockStatus === "none" && <div className="mt-3 flex gap-4 text-sm">
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
                {isOwnProfile && (
                  <Link href={`/${user.username}/following`} className={`hover:underline ${hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}`}>
                    <span className={`font-semibold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {user._count.following}
                    </span>{" "}
                    following
                  </Link>
                )}
                {currentUserId ? (
                  <Link href={`/${user.username}/friends`} className={`hover:underline ${hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}`}>
                    <span className={`font-semibold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {friendsCount}
                    </span>{" "}
                    friends
                  </Link>
                ) : (
                  <span className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                    <span className={`font-semibold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {friendsCount}
                    </span>{" "}
                    friends
                  </span>
                )}
                {user._count.userLists > 0 && (
                  <Link href={`/${user.username}/lists`} className={`hover:underline ${hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}`}>
                    <span className={`font-semibold ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {user._count.userLists}
                    </span>{" "}
                    {user._count.userLists === 1 ? "list" : "lists"}
                  </Link>
                )}
              </div>}
            </div>
          </div>

          {/* Action buttons — below bio, right-aligned */}
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            {isOwnProfile && (
              <Link
                href="/profile"
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-all ${
                  hasCustomTheme
                    ? "profile-share-btn"
                    : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-600 dark:bg-transparent dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
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
            {currentUserId && !isOwnProfile && blockStatus === "none" && (
              <>
                <FollowButton userId={user.id} isFollowing={isFollowing} />
                <FriendButton userId={user.id} friendshipStatus={friendshipStatus} requestId={friendRequestId} />
                {isFriend && <MessageButton userId={user.id} hasCustomTheme={hasCustomTheme} />}
                {!isFriend && <ChatRequestButton userId={user.id} initialStatus={chatRequestStatus} hasCustomTheme={hasCustomTheme} />}
                <SubscribeButton userId={user.id} isSubscribed={isSubscribed} />
                <AddToListButton targetUserId={user.id} lists={listMemberships} />
              </>
            )}
            <ProfileShareButton username={user.username!} hasCustomTheme={hasCustomTheme} />
          </div>
        </div>

        {blockStatus === "none" && (
          <>
        <ProfileTabs username={user.username!} activeTab={activeTab} hasCustomTheme={hasCustomTheme} showMediaTab={hasMediaPosts} showWallTab={showWallInSeparateTab && canSeeWall} showSensitiveTab={hasSensitivePosts} showNsfwTab={hasNsfwPosts} showGraphicTab={hasGraphicPosts} showMarketplaceTab={hasMarketplacePosts} />

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
              {/* Wall post composer — shown to friends on posts tab (when wall is inline) */}
              {currentUserId && isFriend && !isOwnProfile && showWallOnPostsTab && (
                <WallPostComposer
                  wallOwnerId={user.id}
                  wallOwnerName={displayName || "this user"}
                />
              )}
              {feedItems.map((item) =>
                item.type === "post" ? (
                  <PostCard key={`post-${item.data.id}`} post={item.data} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator {...(item.data.wallPost && item.data.wallPost.wallOwner.username && { wallOwner: { username: item.data.wallPost.wallOwner.username, displayName: item.data.wallPost.wallOwner.displayName }, wallPostId: item.data.wallPost.id, wallPostStatus: item.data.wallPost.status })} />
                ) : item.type === "repost" ? (
                  <RepostCard key={`repost-${item.data.id}`} repost={item.data} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator />
                ) : (
                  <PostCard key={`wall-${item.data.id}`} post={item.data.post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} wallOwner={{ username: item.data.wallOwner.username!, displayName: item.data.wallOwner.displayName, usernameFont: item.data.wallOwner.usernameFont }} wallPostId={item.data.id} wallPostStatus={item.data.status} isWallOwner={isOwnProfile} />
                )
              )}
            </div>
          )
        ) : activeTab === "wall" ? (
          wallFeedItems.length === 0 ? (
            <div className="mt-8 text-center">
              <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                No wall posts yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {currentUserId && isFriend && !isOwnProfile && (
                <WallPostComposer
                  wallOwnerId={user.id}
                  wallOwnerName={displayName || "this user"}
                />
              )}
              {wallFeedItems.map((item) =>
                item.type === "wall" ? (
                  <PostCard key={`wall-${item.data.id}`} post={item.data.post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} wallOwner={{ username: item.data.wallOwner.username!, displayName: item.data.wallOwner.displayName, usernameFont: item.data.wallOwner.usernameFont }} wallPostId={item.data.id} wallPostStatus={item.data.status} isWallOwner={isOwnProfile} />
                ) : null
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
                <PostCard key={post.id} post={post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator {...(post.wallPost && post.wallPost.wallOwner.username && { wallOwner: { username: post.wallPost.wallOwner.username, displayName: post.wallPost.wallOwner.displayName, usernameFont: post.wallPost.wallOwner.usernameFont }, wallPostId: post.wallPost.id, wallPostStatus: post.wallPost.status })} />
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
                <PostCard key={post.id} post={post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator {...(post.wallPost && post.wallPost.wallOwner.username && { wallOwner: { username: post.wallPost.wallOwner.username, displayName: post.wallPost.wallOwner.displayName, usernameFont: post.wallPost.wallOwner.usernameFont }, wallPostId: post.wallPost.id, wallPostStatus: post.wallPost.status })} />
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
                <PostCard key={post.id} post={post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} showNsfwContent={showNsfwContent} showPinnedIndicator {...(post.wallPost && post.wallPost.wallOwner.username && { wallOwner: { username: post.wallPost.wallOwner.username, displayName: post.wallPost.wallOwner.displayName, usernameFont: post.wallPost.wallOwner.usernameFont }, wallPostId: post.wallPost.id, wallPostStatus: post.wallPost.status })} />
              ))}
            </div>
          )
        ) : activeTab === "media" ? (
          <ProfileMediaTab userId={user.id} />
        ) : activeTab === "marketplace" ? (
          <ProfileMarketplaceTab userId={user.id} />
        ) : null}
          </>
        )}
      </main>
    </div>
  );
}

async function ProfileMediaTab({ userId }: { userId: string }) {
  const { posts, hasMore } = await fetchUserMediaPosts(userId);
  const boundFetchPage = fetchUserMediaPosts.bind(null, userId);
  if (posts.length === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-zinc-500">No media yet.</p>
        <p className="mt-1 text-sm text-zinc-400">
          Images and videos from posts will appear here.
        </p>
      </div>
    );
  }
  return (
    <MediaGrid
      initialPosts={posts}
      initialHasMore={hasMore}
      fetchPage={boundFetchPage}
    />
  );
}

async function ProfileMarketplaceTab({ userId }: { userId: string }) {
  const { posts, hasMore } = await fetchUserMarketplacePosts(userId);
  const boundFetchPage = fetchUserMarketplacePosts.bind(null, userId);
  if (posts.length === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-zinc-500">No marketplace listings.</p>
      </div>
    );
  }
  return (
    <MarketplaceGrid
      initialPosts={posts}
      initialHasMore={hasMore}
      fetchPage={boundFetchPage}
    />
  );
}
