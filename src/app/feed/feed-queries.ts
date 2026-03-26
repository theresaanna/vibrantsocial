export const PAGE_SIZE = 10;

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
      },
    },
    // Comments are lazy-loaded via fetchComments() when expanded
  } as const;
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
