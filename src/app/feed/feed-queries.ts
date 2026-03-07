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
}

export const repostUserSelect = {
  id: true,
  username: true,
  displayName: true,
  name: true,
  image: true,
  avatar: true,
} as const;
