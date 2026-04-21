import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { cached, cacheKeys } from "@/lib/cache";
import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { ProfileActionsDropdown } from "@/components/profile-actions-dropdown";
import { getFriendshipStatus, getFriendsCount } from "@/app/feed/friend-actions";
import type { FriendshipStatus } from "@/app/feed/friend-actions";
import { isSubscribedToUser } from "@/app/feed/subscription-actions";
import { ProfileShareButton } from "@/components/profile-share-button";
import { FramedAvatar } from "@/components/framed-avatar";
import { BioContent } from "@/components/bio-content";
import { ProfileTabs } from "@/components/profile-tabs";
import { RepostCard } from "@/components/repost-card";
import { getChatRequestStatus, type ChatRequestStatus } from "@/app/messages/actions";
import { deriveBlockStatus } from "@/app/feed/block-actions";
import { buildMetadata, truncateText, SITE_NAME } from "@/lib/metadata";
import { extractTextFromLexicalJson } from "@/lib/lexical-text";
import { PROFILE_THEME_PRESETS } from "@/lib/profile-themes";
import { publishedOnly, buildDigitalFileData } from "@/app/feed/feed-queries";
import { buildProfilePostsContentFilter } from "./profile-queries";
import { MarketplaceGrid } from "@/components/marketplace-grid";
import { fetchUserMarketplacePosts } from "@/app/marketplace/media-actions";
import { fetchUserMediaPosts } from "./media-actions";
import { MediaGrid } from "@/components/media-grid";
import { WallPostComposer } from "@/components/wall-post-composer";
import { getUserListMemberships } from "@/app/lists/actions";
import { AddToListButton } from "@/components/add-to-list-button";
import { ProfileViewToggle } from "@/components/profile-view-toggle";
import { PremiumCrown } from "@/components/premium-crown";
import { ProfileSparklefall } from "@/components/profile-sparklefall";
import { isBirthday, getBirthdaySparkleConfig } from "@/lib/birthday";
import { StyledName } from "@/components/styled-name";
import { getUserPrefs } from "@/lib/user-prefs";
import { getUserStatusHistory } from "@/app/feed/status-actions";
import { timeAgo } from "@/lib/time";
import { isCloseFriend as checkIsCloseFriend } from "@/app/feed/close-friends-actions";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string; view?: string }>;
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
  profileContainerOpacity: true,
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
  phoneVerified: true,
  ageVerified: true,
  isProfilePublic: true,
  hideWallFromFeed: true,
  linksPageEnabled: true,
  tier: true,
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
  const { tab, view } = await searchParams;
  const activeView = view === "media" ? "media" as const : "posts" as const;
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
  // Single cached query replaces 4 separate count queries
  const tabFlags = await cached(
    cacheKeys.profileTabFlags(user.id),
    async () => {
      const result = await prisma.$queryRaw<[{
        has_sensitive: boolean;
        has_nsfw: boolean;
        has_graphic: boolean;
        has_marketplace: boolean;
      }]>`
        SELECT
          bool_or("isSensitive") as has_sensitive,
          bool_or("isNsfw") as has_nsfw,
          bool_or("isGraphicNudity") as has_graphic,
          bool_or(EXISTS(SELECT 1 FROM "MarketplacePost" mp WHERE mp."postId" = p.id)) as has_marketplace
        FROM "Post" p WHERE p."authorId" = ${user.id}
      `;
      const row = result[0];
      return {
        hasSensitive: row?.has_sensitive ?? false,
        hasNsfw: row?.has_nsfw ?? false,
        hasGraphic: row?.has_graphic ?? false,
        hasMarketplace: row?.has_marketplace ?? false,
      };
    },
    120
  );
  const { hasSensitive: hasSensitivePosts, hasNsfw: hasNsfwPosts, hasGraphic: hasGraphicPosts, hasMarketplace: hasMarketplacePosts } = tabFlags;

  const session = await auth();
  const currentUserId = session?.user?.id;

  // Redirect unauthenticated visitors if profile is private
  if (!user.isProfilePublic && !currentUserId) redirect("/login");

  const isOwnProfile = currentUserId === user.id;

  // Check block status — derived from cached block relationships, no extra DB query
  let blockStatus: "none" | "blocked_by_me" | "blocked_by_them" = "none";
  if (currentUserId && !isOwnProfile) {
    blockStatus = await deriveBlockStatus(currentUserId, user.id);
  }

  // Fetch friends count for all profiles
  const friendsCount = blockStatus === "none" ? await getFriendsCount(user.id) : 0;

  // Check if current user follows this profile
  let isFollowing = false;
  let phoneVerified = false;
  let ageVerified = false;
  let showGraphicByDefault = false;
  let hideSensitiveOverlay = false;
  let hideNsfwOverlay = false;
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
    // Reuse cached user prefs (same cache as media/feed pages, 5 min TTL)
    const prefs = await getUserPrefs(currentUserId);
    phoneVerified = prefs.phoneVerified;
    ageVerified = prefs.ageVerified;
    showGraphicByDefault = prefs.showGraphicByDefault;
    hideSensitiveOverlay = prefs.hideSensitiveOverlay;
    hideNsfwOverlay = prefs.hideNsfwOverlay;
    showNsfwContent = prefs.showNsfwContent;
  }

  // Fetch latest status for this user
  const latestStatusArr = blockStatus === "none" && user.username
    ? await getUserStatusHistory(user.username, 1)
    : [];
  const latestStatus = latestStatusArr[0] ?? null;

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
    marketplacePost: {
      select: {
        id: true,
        price: true,
        purchaseUrl: true,
        shippingOption: true,
        shippingPrice: true,
        digitalFile: {
          select: {
            fileName: true,
            fileSize: true,
            isFree: true,
            couponCode: true,
            downloadCount: true,
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

  const repostUserSelect = {
    id: true,
    username: true,
    displayName: true,
    name: true,
    image: true,
    avatar: true,
    profileFrameId: true,
    usernameFont: true,
  };

  const repostInclude = {
    user: { select: repostUserSelect },
    post: { include: postInclude },
    quotedRepost: {
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: repostUserSelect },
        post: { include: postInclude },
      },
    },
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
          ...publishedOnly,
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
        where: { ...publishedOnly, authorId: user.id, isSensitive: true, ...closeFriendsFilter, ...audienceFilter },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: postInclude,
      })
    : [];

  // NSFW tab: only isNsfw posts, only for logged-in users
  const nsfwPosts = activeTab === "nsfw" && currentUserId
    ? await prisma.post.findMany({
        where: { ...publishedOnly, authorId: user.id, isNsfw: true, ...closeFriendsFilter, ...audienceFilter },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: postInclude,
      })
    : [];

  // Graphic/Explicit tab: only isGraphicNudity posts, only for logged-in users
  const graphicPosts = activeTab === "graphic" && currentUserId
    ? await prisma.post.findMany({
        where: { ...publishedOnly, authorId: user.id, isGraphicNudity: true, ...closeFriendsFilter, ...audienceFilter },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: postInclude,
      })
    : [];

  // Wall posts: shown inline in Posts tab (default) or in separate Wall tab (when hideWallFromFeed enabled)
  const isFriend = friendshipStatus === "friends";
  const viewerIsCloseFriend = currentUserId && isFriend && !isOwnProfile
    ? await checkIsCloseFriend(currentUserId, user.id)
    : false;
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
  // `hasCustomTheme` still tracks whether the user overrode any slot —
  // used elsewhere (className) — but the profile always paints with the
  // `default` preset's grays + logo-gradient accents when a slot is
  // unset, so unthemed profiles don't fall through to the bare Tailwind
  // surface.
  const defaultPreset = PROFILE_THEME_PRESETS.default;
  const hasCustomTheme = !!(
    user.profileBgColor ||
    user.profileTextColor ||
    user.profileLinkColor ||
    user.profileSecondaryColor ||
    user.profileContainerColor
  );

  const userHasBirthday = isBirthday(user.birthdayMonth, user.birthdayDay);

  const themeStyle = {
    "--profile-bg": user.profileBgColor ?? defaultPreset.profileBgColor,
    "--profile-text": user.profileTextColor ?? defaultPreset.profileTextColor,
    "--profile-link": user.profileLinkColor ?? defaultPreset.profileLinkColor,
    "--profile-secondary":
      user.profileSecondaryColor ?? defaultPreset.profileSecondaryColor,
    "--profile-container":
      user.profileContainerColor ?? defaultPreset.profileContainerColor,
    "--profile-container-alpha": `${user.profileContainerOpacity ?? 100}%`,
  } as React.CSSProperties;

  const bgImageStyle: React.CSSProperties | undefined = user.profileBgImage
    ? {
        backgroundImage: `url(${user.profileBgImage})`,
        backgroundRepeat: user.profileBgRepeat ?? "no-repeat",
        backgroundAttachment: user.profileBgAttachment ?? "scroll",
        backgroundSize: user.profileBgSize ?? "100% 100%",
        backgroundPosition: user.profileBgPosition ?? "center",
        minHeight: "calc(100vh - 57px)",
      }
    : undefined;

  const isBlocked = blockStatus !== "none";

  return (
    <div
      className={!isBlocked ? "profile-themed" : ""}
      style={isBlocked ? undefined : { ...themeStyle, ...bgImageStyle }}
    >
      {(() => {
        if (isBlocked) return null;

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
        {blockStatus === "none" && latestStatus && (
          <div
            className={`mb-4 rounded-xl border p-3 ${hasCustomTheme ? "profile-container" : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"}`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${hasCustomTheme ? "profile-text-secondary" : "text-zinc-500 dark:text-zinc-400"}`}>
                Recent status
              </span>
              <span className={`text-xs ${hasCustomTheme ? "profile-text-secondary" : "text-zinc-400 dark:text-zinc-500"}`}>
                {timeAgo(latestStatus.createdAt)}
              </span>
            </div>
            <p className={`mt-1 text-base ${hasCustomTheme ? "" : "text-zinc-900 dark:text-zinc-100"}`}>
              {latestStatus.content}
            </p>
          </div>
        )}

        {blockStatus === "none" && userHasBirthday && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-50 to-purple-50 px-3 py-2 dark:from-pink-950/30 dark:to-purple-950/30" data-testid="birthday-banner">
            <span className="text-lg">🎂</span>
            <p className="text-sm font-medium text-pink-700 dark:text-pink-300">
              Happy birthday, {displayName}!
            </p>
          </div>
        )}

        {/* Profile header */}
        <div className={`relative rounded-2xl p-6 shadow-lg ${hasCustomTheme && !isBlocked ? "profile-container" : "bg-white dark:bg-zinc-900"}`}>
          {/* Avatar + name row */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:gap-4">
            <FramedAvatar
              src={blockStatus === "none" ? avatarSrc : undefined}
              alt=""
              initial={blockStatus === "none" ? initial : "?"}
              size={80}
              frameId={blockStatus === "none" ? user.profileFrameId : null}
              referrerPolicy="no-referrer"
            />

            <div className="min-w-0 w-full sm:flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1
                    className={`text-xl font-bold ${hasCustomTheme && blockStatus === "none" ? "" : "text-zinc-900 dark:text-zinc-100"}`}
                    data-testid="profile-display-name"
                  >
                    {blockStatus === "none" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <StyledName fontId={user.usernameFont} ageVerified={!!user.ageVerified}>{displayName}</StyledName>
                        {user.tier === "premium" && (
                          <Link href="/premium" title="Premium member" className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
                            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </Link>
                        )}
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">@{user.username}</span>
                    )}
                  </h1>
                  {blockStatus === "none" && <div className="flex items-center gap-2">
                    <p className={`text-sm ${hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}`}>
                      @{user.username}
                    </p>
                    {user.linksPageEnabled && (
                      <a
                        href={`https://links.vibrantsocial.app/${user.username}`}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                          hasCustomTheme
                            ? "profile-text-secondary"
                            : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
                        }`}
                        style={
                          hasCustomTheme
                            ? ({ borderColor: "var(--profile-secondary)" } as React.CSSProperties)
                            : undefined
                        }
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                          <path fillRule="evenodd" d="M8.914 6.025a.75.75 0 0 1 1.06 0 3.5 3.5 0 0 1 0 4.95l-2 2a3.5 3.5 0 0 1-5.396-4.402.75.75 0 0 1 1.251.827 2 2 0 0 0 2.632 2.989l.07-.036.039-.02 2-2a2 2 0 0 0 0-2.828.75.75 0 0 1-.656-1.48Zm-1.828 3.95a.75.75 0 0 1-1.06 0 3.5 3.5 0 0 1 0-4.95l2-2a3.5 3.5 0 0 1 5.396 4.402.75.75 0 0 1-1.251-.827 2 2 0 0 0-2.632-2.989l-.07.036-.039.02-2 2a2 2 0 0 0 0 2.828.75.75 0 0 1 .656 1.48Z" clipRule="evenodd" />
                        </svg>
                        Links
                      </a>
                    )}
                  </div>}
                  {/* Counts — below @name */}
                  {blockStatus === "none" && <div className="mt-1 flex flex-wrap gap-3 text-sm">
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
                {isOwnProfile && (
                  <div className="flex shrink-0 items-center gap-2">
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
                    <ProfileShareButton username={user.username!} hasCustomTheme={hasCustomTheme} />
                  </div>
                )}
                {currentUserId && !isOwnProfile && blockStatus !== "blocked_by_them" && (
                  <div className="flex shrink-0 items-center gap-2">
                    <ProfileActionsDropdown
                      userId={user.id}
                      isFollowing={isFollowing}
                      friendshipStatus={friendshipStatus}
                      friendRequestId={friendRequestId}
                      isSubscribed={isSubscribed}
                      isFriend={isFriend}
                      isCloseFriend={viewerIsCloseFriend}
                      chatRequestStatus={chatRequestStatus}
                      isBlocked={blockStatus === "blocked_by_me"}
                      hasVerifiedPhone={!!user.phoneVerified}
                    />
                    {blockStatus === "none" && <AddToListButton targetUserId={user.id} lists={listMemberships} />}
                    <ProfileShareButton username={user.username!} hasCustomTheme={hasCustomTheme} />
                  </div>
                )}
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
            </div>
          </div>

          {/* Bio — full width below counts */}
          {blockStatus === "none" && user.bio && (
            <div className="mt-3">
              <BioContent content={user.bio} />
            </div>
          )}

        </div>

        {blockStatus === "none" && (
          <>
        <ProfileTabs username={user.username!} activeTab={activeTab} hasCustomTheme={hasCustomTheme} showWallTab={showWallInSeparateTab && canSeeWall} showSensitiveTab={hasSensitivePosts} showNsfwTab={hasNsfwPosts} showGraphicTab={hasGraphicPosts} showMarketplaceTab={hasMarketplacePosts} />

        <div className="mt-4">
          <ProfileViewToggle username={user.username!} activeView={activeView} />
        </div>

        {/* Tab content */}
        {activeView === "media" && activeTab === "posts" ? (
          <ProfileMediaTab userId={user.id} />
        ) : activeTab === "posts" ? (
          <div className="mt-6 space-y-4">
            {/* Wall post composer — always shown to friends on posts tab */}
            {currentUserId && isFriend && !isOwnProfile && (
              <WallPostComposer
                wallOwnerId={user.id}
                wallOwnerName={displayName || "this user"}
              />
            )}
            {feedItems.length === 0 ? (
              <div className="mt-2 text-center">
                <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                  No posts yet.
                </p>
              </div>
            ) : (
              feedItems.map((item) =>
                item.type === "post" ? (
                  <PostCard key={`post-${item.data.id}`} post={item.data} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} hideSensitiveOverlay={hideSensitiveOverlay} hideNsfwOverlay={hideNsfwOverlay} showNsfwContent={showNsfwContent} showPinnedIndicator {...(item.data.wallPost && item.data.wallPost.wallOwner.username && { wallOwner: { username: item.data.wallPost.wallOwner.username, displayName: item.data.wallPost.wallOwner.displayName }, wallPostId: item.data.wallPost.id, wallPostStatus: item.data.wallPost.status })} {...(item.data.marketplacePost && { marketplacePostId: item.data.marketplacePost.id, marketplaceData: { price: item.data.marketplacePost.price, purchaseUrl: item.data.marketplacePost.purchaseUrl, shippingOption: item.data.marketplacePost.shippingOption, shippingPrice: item.data.marketplacePost.shippingPrice }, digitalFileData: buildDigitalFileData(item.data.marketplacePost, item.data.author?.id, currentUserId) })} />
                ) : item.type === "repost" ? (
                  <RepostCard key={`repost-${item.data.id}`} repost={item.data} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} hideSensitiveOverlay={hideSensitiveOverlay} hideNsfwOverlay={hideNsfwOverlay} showNsfwContent={showNsfwContent} showPinnedIndicator />
                ) : (
                  <PostCard key={`wall-${item.data.id}`} post={item.data.post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} hideSensitiveOverlay={hideSensitiveOverlay} hideNsfwOverlay={hideNsfwOverlay} showNsfwContent={showNsfwContent} wallOwner={{ username: item.data.wallOwner.username!, displayName: item.data.wallOwner.displayName, usernameFont: item.data.wallOwner.usernameFont }} wallPostId={item.data.id} wallPostStatus={item.data.status} isWallOwner={isOwnProfile} />
                )
              )
            )}
          </div>
        ) : activeTab === "wall" ? (
          <div className="mt-6 space-y-4">
            {currentUserId && isFriend && !isOwnProfile && (
              <WallPostComposer
                wallOwnerId={user.id}
                wallOwnerName={displayName || "this user"}
              />
            )}
            {wallFeedItems.length === 0 ? (
              <div className={`rounded-xl p-6 text-center ${hasCustomTheme ? "profile-container" : "bg-zinc-50 dark:bg-zinc-800/50"}`}>
                <p className={hasCustomTheme ? "profile-text-secondary" : "text-zinc-500"}>
                  No wall posts yet.
                </p>
              </div>
            ) : (
              wallFeedItems.map((item) =>
                item.type === "wall" ? (
                  <PostCard key={`wall-${item.data.id}`} post={item.data.post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} hideSensitiveOverlay={hideSensitiveOverlay} hideNsfwOverlay={hideNsfwOverlay} showNsfwContent={showNsfwContent} wallOwner={{ username: item.data.wallOwner.username!, displayName: item.data.wallOwner.displayName, usernameFont: item.data.wallOwner.usernameFont }} wallPostId={item.data.id} wallPostStatus={item.data.status} isWallOwner={isOwnProfile} />
                ) : null
              )
            )}
          </div>
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
                <PostCard key={post.id} post={post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} hideSensitiveOverlay={hideSensitiveOverlay} hideNsfwOverlay={hideNsfwOverlay} showNsfwContent={showNsfwContent} showPinnedIndicator {...(post.wallPost && post.wallPost.wallOwner.username && { wallOwner: { username: post.wallPost.wallOwner.username, displayName: post.wallPost.wallOwner.displayName, usernameFont: post.wallPost.wallOwner.usernameFont }, wallPostId: post.wallPost.id, wallPostStatus: post.wallPost.status })} />
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
                <PostCard key={post.id} post={post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} hideSensitiveOverlay={hideSensitiveOverlay} hideNsfwOverlay={hideNsfwOverlay} showNsfwContent={showNsfwContent} showPinnedIndicator {...(post.wallPost && post.wallPost.wallOwner.username && { wallOwner: { username: post.wallPost.wallOwner.username, displayName: post.wallPost.wallOwner.displayName, usernameFont: post.wallPost.wallOwner.usernameFont }, wallPostId: post.wallPost.id, wallPostStatus: post.wallPost.status })} />
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
                <PostCard key={post.id} post={post} currentUserId={currentUserId} phoneVerified={phoneVerified} ageVerified={ageVerified} showGraphicByDefault={showGraphicByDefault} hideSensitiveOverlay={hideSensitiveOverlay} hideNsfwOverlay={hideNsfwOverlay} showNsfwContent={showNsfwContent} showPinnedIndicator {...(post.wallPost && post.wallPost.wallOwner.username && { wallOwner: { username: post.wallPost.wallOwner.username, displayName: post.wallPost.wallOwner.displayName, usernameFont: post.wallPost.wallOwner.usernameFont }, wallPostId: post.wallPost.id, wallPostStatus: post.wallPost.status })} />
              ))}
            </div>
          )
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
