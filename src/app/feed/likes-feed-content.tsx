import { prisma } from "@/lib/prisma";
import { PostCard } from "@/components/post-card";
import { getPostInclude } from "./feed-queries";

export async function LikesFeedContent({ userId }: { userId: string }) {
  const [currentUser, likes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        phoneVerified: true,
        ageVerified: true,
        showGraphicByDefault: true,
        hideSensitiveOverlay: true,
        hideNsfwOverlay: true,
        showNsfwContent: true,
      },
    }),
    prisma.like.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        post: { include: getPostInclude(userId) },
      },
    }),
  ]);

  if (!currentUser) return null;

  const posts = likes.map((l) => l.post);

  if (posts.length === 0) {
    return (
      <div className="mt-8 text-center">
        <p className="text-zinc-500">No liked posts yet.</p>
        <p className="mt-1 text-sm text-zinc-400">
          Like posts to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={userId}
          phoneVerified={!!currentUser.phoneVerified}
          ageVerified={!!currentUser.ageVerified}
          showGraphicByDefault={currentUser.showGraphicByDefault ?? false}
          hideSensitiveOverlay={currentUser.hideSensitiveOverlay ?? false}
          hideNsfwOverlay={currentUser.hideNsfwOverlay ?? false}
          showNsfwContent={currentUser.showNsfwContent ?? false}
          {...(post.wallPost && post.wallPost.wallOwner.username && {
            wallOwner: {
              username: post.wallPost.wallOwner.username,
              displayName: post.wallPost.wallOwner.displayName,
              usernameFont: post.wallPost.wallOwner.usernameFont,
            },
            wallPostId: post.wallPost.id,
            wallPostStatus: post.wallPost.status,
          })}
        />
      ))}
    </div>
  );
}
