import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getPostsByTag } from "@/app/tags/actions";
import { TagPostList } from "./tag-post-list";

interface TagPageProps {
  params: Promise<{ name: string }>;
}

export default async function TagPage({ params }: TagPageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name).toLowerCase();

  const tag = await prisma.tag.findUnique({
    where: { name: decodedName },
  });

  if (!tag) notFound();

  const session = await auth();
  const currentUserId = session?.user?.id;

  let phoneVerified = false;
  let biometricVerified = false;
  let showGraphicByDefault = false;
  let showNsfwContent = false;

  if (currentUserId) {
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        phoneVerified: true,
        biometricVerified: true,
        showGraphicByDefault: true,
        showNsfwContent: true,
      },
    });
    phoneVerified = !!currentUser?.phoneVerified;
    biometricVerified = !!currentUser?.biometricVerified;
    showGraphicByDefault = currentUser?.showGraphicByDefault ?? false;
    showNsfwContent = currentUser?.showNsfwContent ?? false;
  }

  const initialData = await getPostsByTag(decodedName, currentUserId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          #{decodedName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {initialData.totalCount}{" "}
          {initialData.totalCount === 1 ? "post" : "posts"}
        </p>
      </div>

      <TagPostList
        tagName={decodedName}
        initialPosts={initialData.posts}
        initialHasMore={initialData.hasMore}
        currentUserId={currentUserId}
        phoneVerified={phoneVerified}
        biometricVerified={biometricVerified}
        showGraphicByDefault={showGraphicByDefault}
        showNsfwContent={showNsfwContent}
      />
    </main>
  );
}
