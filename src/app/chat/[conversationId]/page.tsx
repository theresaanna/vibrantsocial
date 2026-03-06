import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getConversations, getMessages, getMessageRequests } from "../actions";
import { ConversationPageClient } from "./conversation-page-client";

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

  const [conversations, { messages }, messageRequests, conversation] =
    await Promise.all([
      getConversations(),
      getMessages(conversationId),
      getMessageRequests(),
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
                  image: true,
                },
              },
            },
          },
        },
      }),
    ]);

  if (!conversation) redirect("/chat");

  return (
    <ConversationPageClient
      conversationId={conversationId}
      conversations={conversations}
      messageRequests={messageRequests}
      initialMessages={messages}
      conversation={conversation}
      currentUserId={session.user.id}
    />
  );
}
