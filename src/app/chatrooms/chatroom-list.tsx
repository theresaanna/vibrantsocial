import Link from "next/link";
import { auth } from "@/auth";
import { getUserPrefs } from "@/lib/user-prefs";
import { listChatRooms } from "./actions";

export async function ChatRoomList() {
  const session = await auth();
  const prefs = session?.user?.id
    ? await getUserPrefs(session.user.id)
    : null;

  const rooms = await listChatRooms(prefs?.showNsfwContent ?? false);

  /* Always show Lounge, even if it hasn't been created in the DB yet */
  const hasLounge = rooms.some((r) => r.slug === "lounge");
  const displayed = hasLounge
    ? rooms
    : [
        {
          id: "default-lounge",
          slug: "lounge",
          name: "Lounge",
          status: null,
          isNsfw: false,
          messageCount: 0,
          lastMessageAt: null,
        },
        ...rooms,
      ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {displayed.map((room) => (
        <Link
          key={room.id}
          href={`/chatrooms/${room.slug}`}
          className={`group flex items-start gap-3 rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${
            room.isNsfw
              ? "border-red-200 bg-red-50/50 hover:border-red-300 dark:border-red-900/40 dark:bg-red-950/20 dark:hover:border-red-800"
              : "border-zinc-200 bg-white hover:border-fuchsia-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-fuchsia-700"
          }`}
        >
          {/* Icon */}
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-transform group-hover:scale-105 ${
              room.isNsfw
                ? "bg-gradient-to-br from-red-400 to-red-600"
                : "bg-gradient-to-br from-fuchsia-400 to-pink-600"
            }`}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
              />
            </svg>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2
                className={`text-sm font-semibold ${
                  room.isNsfw
                    ? "text-zinc-900 group-hover:text-red-600 dark:text-zinc-100 dark:group-hover:text-red-400"
                    : "text-zinc-900 group-hover:text-fuchsia-600 dark:text-zinc-100 dark:group-hover:text-fuchsia-400"
                }`}
              >
                {room.name}
              </h2>
              {room.isNsfw && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-red-600 dark:bg-red-900/40 dark:text-red-400">
                  NSFW
                </span>
              )}
            </div>
            {room.status && (
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {room.status}
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
              <span>
                {room.messageCount.toLocaleString()}{" "}
                {room.messageCount === 1 ? "message" : "messages"}
              </span>
              {room.lastMessageAt && (
                <span>
                  Last active{" "}
                  {new Date(room.lastMessageAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Arrow */}
          <svg
            className={`mt-1 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${
              room.isNsfw
                ? "text-zinc-300 group-hover:text-red-400 dark:text-zinc-600 dark:group-hover:text-red-500"
                : "text-zinc-300 group-hover:text-fuchsia-400 dark:text-zinc-600 dark:group-hover:text-fuchsia-500"
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </Link>
      ))}

      {displayed.length === 0 && (
        <p className="col-span-full py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No chat rooms yet. Check back soon!
        </p>
      )}
    </div>
  );
}
