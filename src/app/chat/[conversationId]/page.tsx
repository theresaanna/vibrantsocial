import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePhoneVerification } from "@/lib/phone-gate";
import { requireNotSuspended } from "@/lib/suspension-gate";
import { getConversations, getMessages, getMessageRequests, getFriendsForChat } from "../actions";
import { getBlockStatus } from "@/app/feed/block-actions";
import { ConversationPageClient } from "./conversation-page-client";
import { generateAdaptiveTheme } from "@/lib/profile-themes";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Conversation",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ conversationId: string }>;
}

export default async function ConversationPage({ params }: Props) {
  const { conversationId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Verify user is a participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
  });
  if (!participant) redirect("/chat");

  const [conversations, { messages }, messageRequests, friends, conversation, phoneVerified, notSuspended, currentUser] =
    await Promise.all([
      getConversations(),
      getMessages(conversationId),
      getMessageRequests(),
      getFriendsForChat(),
      prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  name: true,
                  avatar: true,
                  profileFrameId: true,
                  image: true,
                },
              },
            },
          },
        },
      }),
      requirePhoneVerification(session.user.id),
      requireNotSuspended(session.user.id),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          ...userThemeSelect,
        },
      }),
    ]);

  if (!conversation) redirect("/chat");

  // Check block status for 1:1 chats
  let isBlocked = false;
  if (!conversation.isGroup) {
    const otherParticipant = conversation.participants.find(
      (p: { userId: string }) => p.userId !== session.user.id
    );
    if (otherParticipant) {
      const blockStatus = await getBlockStatus(otherParticipant.userId);
      isBlocked = blockStatus !== "none";
    }
  }

  const hasCustomTheme = !!(
    currentUser?.profileBgColor ||
    currentUser?.profileTextColor ||
    currentUser?.profileLinkColor ||
    currentUser?.profileSecondaryColor ||
    currentUser?.profileContainerColor
  );

  const themeColors = {
    bgColor: currentUser?.profileBgColor ?? null,
    textColor: currentUser?.profileTextColor ?? null,
    containerColor: currentUser?.profileContainerColor ?? null,
    secondaryColor: currentUser?.profileSecondaryColor ?? null,
  };

  const themeStyle = hasCustomTheme
    ? (() => {
        const userColors = {
          profileBgColor: currentUser?.profileBgColor ?? "#ffffff",
          profileTextColor: currentUser?.profileTextColor ?? "#18181b",
          profileLinkColor: currentUser?.profileLinkColor ?? "#2563eb",
          profileSecondaryColor: currentUser?.profileSecondaryColor ?? "#71717a",
          profileContainerColor: currentUser?.profileContainerColor ?? "#f4f4f5",
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

  const profileTheme = currentUser ? await buildUserTheme(currentUser) : null;

  return (
    <ThemedPage {...(profileTheme ?? NO_THEME)} bare>
    <ConversationPageClient
      conversationId={conversationId}
      conversations={conversations}
      messageRequests={messageRequests}
      friends={friends}
      initialMessages={messages}
      conversation={conversation}
      currentUserId={session.user.id}
      phoneVerified={phoneVerified && notSuspended}
      isBlocked={isBlocked}
      themeColors={themeColors}
      hasCustomTheme={hasCustomTheme}
      themeStyle={themeStyle}
    />
    </ThemedPage>
  );
}
