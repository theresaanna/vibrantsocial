import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getConversations, getMessageRequests } from "./actions";
import { ChatPageClient } from "./chat-page-client";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dateOfBirth: true },
  });
  if (!user?.dateOfBirth) redirect("/complete-profile");

  const conversations = await getConversations();
  const messageRequests = await getMessageRequests();

  return (
    <ChatPageClient
      conversations={conversations}
      messageRequests={messageRequests}
    />
  );
}
