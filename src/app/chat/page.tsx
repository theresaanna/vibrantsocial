import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getConversations, getMessageRequests, getFriendsForChat } from "./actions";
import { ChatPageClient } from "./chat-page-client";
import { generateAdaptiveTheme } from "@/lib/profile-themes";
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
    containerColor: user.profileContainerColor ?? null,
    secondaryColor: user.profileSecondaryColor ?? null,
  };

  const themeStyle = hasCustomTheme
    ? (() => {
        const userColors = {
          profileBgColor: user.profileBgColor ?? "#ffffff",
          profileTextColor: user.profileTextColor ?? "#18181b",
          profileLinkColor: user.profileLinkColor ?? "#2563eb",
          profileSecondaryColor: user.profileSecondaryColor ?? "#71717a",
          profileContainerColor: user.profileContainerColor ?? "#f4f4f5",
        };
        const { light, dark } = generateAdaptiveTheme(userColors);
        return {
          "--chat-bubble-bg-light": light.profileBgColor,
          "--chat-bubble-text-light": light.profileTextColor,
          "--chat-active-bg-light": light.profileContainerColor,
          "--chat-active-text-light": light.profileSecondaryColor,
          "--chat-bubble-bg-dark": dark.profileBgColor,
          "--chat-bubble-text-dark": dark.profileTextColor,
          "--chat-active-bg-dark": dark.profileContainerColor,
          "--chat-active-text-dark": dark.profileSecondaryColor,
        } as React.CSSProperties;
      })()
    : undefined;

  const profileTheme = await buildUserTheme(user);

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
