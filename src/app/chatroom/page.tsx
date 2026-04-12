import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getChatRoomMessages } from "./actions";
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

  const [{ messages }, user] = await Promise.all([
    getChatRoomMessages("lobby"),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: userThemeSelect,
    }),
  ]);

  const profileTheme = user ? buildUserTheme(user) : NO_THEME;

  return (
    <ThemedPage {...profileTheme} bare>
      <main className="mx-auto flex h-[calc(100dvh-4rem)] max-w-3xl flex-col px-4 py-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-600">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Chat Room</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Public lobby &mdash; everyone can chat here</p>
          </div>
        </div>

        <ChatRoomClient
          initialMessages={messages}
          currentUserId={session.user.id}
          room="lobby"
        />
      </main>
    </ThemedPage>
  );
}
