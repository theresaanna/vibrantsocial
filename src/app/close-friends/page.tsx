import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCloseFriends, getCloseFriendIds, getAcceptedFriends } from "@/app/feed/close-friends-actions";
import { CloseFriendsPageClient } from "./close-friends-page-client";
import { isProfileIncomplete } from "@/lib/require-profile";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Manage Close Friends",
  robots: { index: false, follow: false },
};

export default async function CloseFriendsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [currentUser, closeFriends, closeFriendIds, allFriends] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        ...userThemeSelect,
      },
    }),
    getCloseFriends(),
    getCloseFriendIds(userId),
    getAcceptedFriends(),
  ]);

  if (!currentUser || isProfileIncomplete(currentUser)) redirect("/complete-profile");

  const theme = buildUserTheme(currentUser);

  const closeFriendIdSet = new Set(closeFriendIds);
  const availableFriends = allFriends.filter((f) => !closeFriendIdSet.has(f.id));

  return (
    <ThemedPage {...theme}>
      <CloseFriendsPageClient
        closeFriends={JSON.parse(JSON.stringify(closeFriends))}
        availableFriends={JSON.parse(JSON.stringify(availableFriends))}
      />
    </ThemedPage>
  );
}
