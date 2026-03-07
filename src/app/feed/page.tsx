import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FeedContent } from "./feed-content";
import { FeedSkeleton } from "@/components/feed-skeleton";

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Suspense fallback={<FeedSkeleton />}>
        <FeedContent userId={session.user.id} />
      </Suspense>
    </main>
  );
}
