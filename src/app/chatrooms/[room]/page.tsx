import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { getChatRoomMessages, getChatRoomMeta } from "../actions";
import { ChatRoomClient } from "../chatroom-client";
import { getUserPrefs } from "@/lib/user-prefs";
import { userThemeSelect, buildUserTheme, NO_THEME } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";
import Link from "next/link";

interface ChatRoomPageProps {
  params: Promise<{ room: string }>;
}

export async function generateMetadata({ params }: ChatRoomPageProps): Promise<Metadata> {
  const { room } = await params;
  const slug = decodeURIComponent(room);
  const displayName = slug.charAt(0).toUpperCase() + slug.slice(1);

  return {
    title: `${displayName} — Chat Rooms`,
    robots: { index: false, follow: false },
  };
}

export default async function ChatRoomPage({ params }: ChatRoomPageProps) {
  const { room } = await params;
  const slug = decodeURIComponent(room);

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let roomMeta;
  try {
    roomMeta = await getChatRoomMeta(slug);
  } catch {
    notFound();
  }

  // Block access to NSFW rooms when user hasn't enabled NSFW content
  if (roomMeta.isNsfw) {
    const prefs = await getUserPrefs(session.user.id);
    if (!prefs.showNsfwContent) redirect("/chatrooms");
  }

  const [{ messages }, user] = await Promise.all([
    getChatRoomMessages(slug),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: userThemeSelect,
    }),
  ]);

  const profileTheme = user ? buildUserTheme(user) : NO_THEME;
  const displayName = roomMeta.name || (slug.charAt(0).toUpperCase() + slug.slice(1));

  return (
    <ThemedPage {...profileTheme} bare>
      <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-5xl flex-col px-2 py-2 md:px-4 md:py-6">
        <div className="mb-4 hidden items-center gap-3 md:mb-6 md:flex">
          <Link
            href="/chatrooms"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            aria-label="Back to chat rooms"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "var(--profile-link, #d946ef)" }}>
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {displayName}
          </h1>
        </div>

        {/* Mobile back link */}
        <div className="mb-2 flex items-center gap-2 md:hidden">
          <Link
            href="/chatrooms"
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label="Back to chat rooms"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {displayName}
          </h1>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <ChatRoomClient
            initialMessages={messages}
            currentUserId={session.user.id}
            room={slug}
            roomMeta={roomMeta}
          />
        </div>
      </div>
    </ThemedPage>
  );
}
