import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getChatRoomMessages, getChatRoomMeta } from "./actions";
import { ChatRoomClient } from "./chatroom-client";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";

export const metadata: Metadata = {
  title: "Chat Room",
  robots: { index: false, follow: false },
};

export default async function ChatRoomPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [{ messages }, roomMeta, user] = await Promise.all([
    getChatRoomMessages("lobby"),
    getChatRoomMeta("lobby"),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: userThemeSelect,
    }),
  ]);

  const profileTheme = user ? buildUserTheme(user) : NO_THEME;

  return (
    <ThemedPage {...profileTheme} bare>
      <main className="mx-auto flex h-[calc(100dvh-4rem)] max-w-5xl flex-col px-4 py-4">
        <ChatRoomClient
          initialMessages={messages}
          currentUserId={session.user.id}
          room="lobby"
          roomMeta={roomMeta}
        />
      </main>
    </ThemedPage>
  );
}
