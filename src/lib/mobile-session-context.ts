/**
 * Request-scoped session storage for mobile bearer token auth.
 *
 * When a mobile client sends a request with an Authorization header,
 * the RPC route (or any route handler) can verify the token and store
 * the session here. The `authWithMobileFallback()` helper checks this
 * storage as a fallback when the cookie-based `auth()` returns null.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { Session } from "next-auth";

export const mobileSessionStorage = new AsyncLocalStorage<Session>();

/**
 * Run a callback with a mobile session available via AsyncLocalStorage.
 */
export function withMobileSession<T>(session: Session, fn: () => T): T {
  return mobileSessionStorage.run(session, fn);
}

/**
 * Get the mobile session from the current async context, if any.
 */
export function getMobileSession(): Session | undefined {
  return mobileSessionStorage.getStore();
}
