/**
 * Call a server function via the /api/rpc route handler.
 *
 * Use this instead of calling server actions directly from useEffect,
 * timers, scroll observers, and debounce callbacks.  The route handler
 * returns plain JSON (no RSC flight data), so in-flight responses that
 * arrive after navigation cannot cause the router to flash a stale page.
 *
 * @example
 *   const convos = await rpc<ConversationListItem[]>("getConversations");
 *   const result = await rpc<{ users: User[]; hasMore: boolean }>("searchUsers", "alice");
 */
export async function rpc<T>(action: string, ...args: unknown[]): Promise<T> {
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  if (!res.ok) {
    throw new Error(`rpc(${action}) failed: ${res.status}`);
  }
  return res.json();
}
