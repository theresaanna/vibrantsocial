import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTagCloudData, getNsfwTagCloudData } from "@/app/tags/actions";
import { TagCloud } from "./tag-cloud";

export default async function CommunitiesPage() {
  const tagData = await getTagCloudData();

  const session = await auth();
  let nsfwTagData: { name: string; count: number }[] = [];

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { showNsfwContent: true },
    });
    if (user?.showNsfwContent) {
      nsfwTagData = await getNsfwTagCloudData();
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Communities
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Explore topics and discover posts by tag.
        </p>
      </div>

      {tagData.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">
            No tags yet. Be the first to tag a post!
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
          <TagCloud tags={tagData} />
        </div>
      )}

      {nsfwTagData.length > 0 && (
        <>
          <div className="mb-4 mt-8">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              NSFW Communities
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Tags from NSFW posts.
            </p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
            <TagCloud tags={nsfwTagData} />
          </div>
        </>
      )}
    </main>
  );
}
