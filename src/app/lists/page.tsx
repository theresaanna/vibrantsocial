import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getUserLists, getCollaboratingLists } from "./actions";
import { ListsPageClient } from "./lists-page-client";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Lists",
  robots: { index: false, follow: false },
};

export default async function ListsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [lists, collaboratingLists, themeUser] = await Promise.all([
    getUserLists(),
    getCollaboratingLists(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: userThemeSelect,
    }),
  ]);

  const theme = themeUser ? buildUserTheme(themeUser) : null;

  return (
    <ThemedPage {...(theme ?? NO_THEME)}>
      <ListsPageClient
        lists={JSON.parse(JSON.stringify(lists))}
        collaboratingLists={JSON.parse(JSON.stringify(collaboratingLists))}
      />
    </ThemedPage>
  );
}
