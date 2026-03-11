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
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-pink-600">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Communities
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Explore topics and discover posts by tag
          </p>
        </div>
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
