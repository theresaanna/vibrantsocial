import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getConversations, getMessageRequests, getFriendsForChat } from "./actions";
import { ChatPageClient } from "./chat-page-client";
import { isProfileIncomplete } from "@/lib/require-profile";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      username: true,
      email: true,
      dateOfBirth: true,
      ...userThemeSelect,
    },
  });
  if (!user || isProfileIncomplete(user)) redirect("/complete-profile");

  const [conversations, messageRequests, friends] = await Promise.all([
    getConversations(),
    getMessageRequests(),
    getFriendsForChat(),
  ]);

  const hasCustomTheme = !!(
    user.profileBgColor ||
    user.profileTextColor ||
    user.profileLinkColor ||
    user.profileSecondaryColor ||
    user.profileContainerColor
  );

  const themeColors = {
    bgColor: user.profileBgColor ?? null,
    textColor: user.profileTextColor ?? null,
    linkColor: user.profileLinkColor ?? null,
    containerColor: user.profileContainerColor ?? null,
    secondaryColor: user.profileSecondaryColor ?? null,
  };

  const themeStyle = hasCustomTheme
    ? ({
        "--chat-bubble-bg": user.profileBgColor ?? "#ffffff",
        "--chat-bubble-text": user.profileTextColor ?? "#18181b",
        "--chat-active-bg": user.profileContainerColor ?? "#f4f4f5",
        "--chat-active-text": user.profileSecondaryColor ?? "#71717a",
        "--chat-link-color": user.profileLinkColor ?? "#2563eb",
      } as React.CSSProperties)
    : undefined;

  const profileTheme = buildUserTheme(user);

  return (
    <ThemedPage {...profileTheme} bare>
      <ChatPageClient
        conversations={conversations}
        messageRequests={messageRequests}
        friends={friends}
        themeColors={themeColors}
        hasCustomTheme={hasCustomTheme}
        themeStyle={themeStyle}
      />
    </ThemedPage>
  );
}
