export const PAGE_SIZE = 10;

/** Filter that excludes scheduled (not-yet-published) posts from queries */
export const publishedOnly = { scheduledFor: null } as const;

export function getPostInclude(userId: string) {
  return {
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
        tier: true,
        // Theme colors for post theming
        profileBgColor: true,
        profileTextColor: true,
        profileLinkColor: true,
        profileSecondaryColor: true,
        profileContainerColor: true,
        profileContainerOpacity: true,
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
      where: { userId },
      select: { id: true },
    },
    bookmarks: {
      where: { userId },
      select: { id: true },
    },
    reposts: {
      where: { userId },
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
    // Comments are lazy-loaded via fetchComments() when expanded
  } as const;
}

/**
 * Build digitalFileData props for PostCard from a marketplacePost query result.
 * Returns undefined when there is no digital file attached.
 */
export function buildDigitalFileData(
  marketplacePost: {
    digitalFile?: {
      fileName: string;
      fileSize: number;
      isFree: boolean;
      couponCode: string | null;
      downloadCount: number;
    } | null;
  } | null | undefined,
  postAuthorId: string | null | undefined,
  currentUserId: string | null | undefined
) {
  const file = marketplacePost?.digitalFile;
  if (!file) return undefined;
  const isOwner = !!currentUserId && currentUserId === postAuthorId;
  return {
    fileName: file.fileName,
    fileSize: file.fileSize,
    isFree: file.isFree,
    couponCode: isOwner ? (file.couponCode ?? undefined) : undefined,
    downloadCount: isOwner ? file.downloadCount : undefined,
    isOwner,
  };
}

export const repostUserSelect = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  image: true,
  avatar: true,
  profileFrameId: true,
  usernameFont: true,
} as const;

export function getRepostInclude(userId: string) {
  return {
    user: { select: repostUserSelect },
    post: { include: getPostInclude(userId) },
    quotedRepost: {
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: repostUserSelect },
        post: { include: getPostInclude(userId) },
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
      where: { userId },
      select: { id: true },
    },
    bookmarks: {
      where: { userId },
      select: { id: true },
    },
  } as const;
}
