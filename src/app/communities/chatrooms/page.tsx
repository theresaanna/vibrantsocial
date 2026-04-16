import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getChatRoomMessages, getChatRoomMeta } from "./actions";
import { ChatRoomClient } from "./chatroom-client";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";
import { CommunitiesViewToggle } from "../communities-view-toggle";

export const metadata: Metadata = {
  title: "Chat Rooms — Communities",
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
      <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-5xl flex-col px-2 py-2 md:px-4 md:py-6">
        <div className="mb-4 hidden items-center gap-3 md:mb-6 md:flex">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-pink-600">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              Communities
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Find topical people and posts
            </p>
          </div>
        </div>

        <CommunitiesViewToggle activeView="chatrooms" hasCustomTheme={profileTheme.hasCustomTheme} />

        <div className="flex min-h-0 flex-1 flex-col">
          <ChatRoomClient
            initialMessages={messages}
            currentUserId={session.user.id}
            room="lobby"
            roomMeta={roomMeta}
          />
        </div>
      </div>
    </ThemedPage>
  );
}
