import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getPostsByTag } from "@/app/tags/actions";
import { TagPostList } from "./tag-post-list";
import { TagSubscribeButton } from "./tag-subscribe-button";
import { NsfwTagToggle } from "./nsfw-tag-toggle";
import { buildMetadata, SITE_NAME } from "@/lib/metadata";
import { isAdmin } from "@/lib/admin";

interface TagPageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name).toLowerCase();

  const tag = await prisma.tag.findUnique({
    where: { name: decodedName },
    select: { name: true, _count: { select: { posts: true } } },
  });

  if (!tag) return { title: "Tag Not Found" };

  return buildMetadata({
    title: `#${tag.name}`,
    description: `Browse ${tag._count.posts} ${tag._count.posts === 1 ? "post" : "posts"} tagged #${tag.name} on ${SITE_NAME}.`,
    path: `/tag/${encodeURIComponent(tag.name)}`,
  });
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
  let ageVerified = false;
  let showGraphicByDefault = false;
  let showNsfwContent = false;

  if (currentUserId) {
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        phoneVerified: true,
        ageVerified: true,
        showGraphicByDefault: true,
        showNsfwContent: true,
      },
    });
    phoneVerified = !!currentUser?.phoneVerified;
    ageVerified = !!currentUser?.ageVerified;
    showGraphicByDefault = currentUser?.showGraphicByDefault ?? false;
    showNsfwContent = currentUser?.showNsfwContent ?? false;
  }

  let subscriptionStatus: { subscribed: boolean; frequency: string } | null =
    null;
  if (currentUserId) {
    const sub = await prisma.tagSubscription.findUnique({
      where: { userId_tagId: { userId: currentUserId, tagId: tag.id } },
    });
    subscriptionStatus = sub
      ? { subscribed: true, frequency: sub.frequency }
      : { subscribed: false, frequency: "immediate" };
  }

  const initialData = await getPostsByTag(decodedName, currentUserId, undefined, showNsfwContent);
  const userIsAdmin = isAdmin(currentUserId);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              #{decodedName}
              {tag.isNsfw && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  NSFW
                </span>
              )}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {initialData.totalCount}{" "}
              {initialData.totalCount === 1 ? "post" : "posts"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {userIsAdmin && (
              <NsfwTagToggle tagId={tag.id} initialIsNsfw={tag.isNsfw} />
            )}
            {currentUserId && subscriptionStatus && (
              <TagSubscribeButton
                tagId={tag.id}
                tagName={decodedName}
                initialSubscribed={subscriptionStatus.subscribed}
                initialFrequency={subscriptionStatus.frequency}
                initialEmailNotification={subscriptionStatus.emailNotification}
              />
            )}
          </div>
        </div>
      </div>

      <TagPostList
        tagName={decodedName}
        initialPosts={initialData.posts}
        initialHasMore={initialData.hasMore}
        currentUserId={currentUserId}
        phoneVerified={phoneVerified}
        ageVerified={ageVerified}
        showGraphicByDefault={showGraphicByDefault}
        showNsfwContent={showNsfwContent}
      />
    </main>
  );
}
