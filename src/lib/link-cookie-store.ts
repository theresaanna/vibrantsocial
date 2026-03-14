import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Thread-safe store for the `linkFromUserId` cookie value.
 *
 * The NextAuth JWT callback needs to read `linkFromUserId` to detect an
 * account-linking flow.  `cookies()` from `next/headers` can silently fail
 * inside NextAuth callbacks in certain Next.js versions.  As a fallback the
 * route handler extracts the cookie from the raw request and stores it here
 * via `AsyncLocalStorage.run()`.  The JWT callback can then read it with
 * `linkCookieStore.getStore()`.
 */
export const linkCookieStore = new AsyncLocalStorage<string | undefined>();
