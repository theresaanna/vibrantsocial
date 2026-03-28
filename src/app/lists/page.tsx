import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserLists, getCollaboratingLists } from "./actions";
import { ListsPageClient } from "./lists-page-client";

export const metadata: Metadata = {
  title: "Lists",
  robots: { index: false, follow: false },
};

export default async function ListsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [lists, collaboratingLists] = await Promise.all([
    getUserLists(),
    getCollaboratingLists(),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <ListsPageClient
        lists={JSON.parse(JSON.stringify(lists))}
        collaboratingLists={JSON.parse(JSON.stringify(collaboratingLists))}
      />
    </main>
  );
}
