import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { calculateAge } from "@/lib/age-gate";

export default async function LikesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      phoneVerified: true,
      dateOfBirth: true,
      biometricVerified: true,
      showNsfwByDefault: true,
    },
  });

  if (!currentUser?.dateOfBirth) redirect("/complete-profile");

  const phoneVerified = !!currentUser?.phoneVerified;
  const biometricVerified = !!currentUser?.biometricVerified;
  const showNsfwByDefault = currentUser?.showNsfwByDefault ?? false;

  const likes = await prisma.like.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      post: {
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
            orderBy: { createdAt: "asc" },
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
                orderBy: { createdAt: "asc" },
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
        },
      },
    },
  });

  const posts = likes.map((l) => l.post);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
        Liked Posts
      </h1>

      {posts.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-zinc-500">No liked posts yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Like posts to see them here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={userId}
              phoneVerified={phoneVerified}
              biometricVerified={biometricVerified}
              showNsfwByDefault={showNsfwByDefault}
            />
          ))}
        </div>
      )}
    </main>
  );
}
