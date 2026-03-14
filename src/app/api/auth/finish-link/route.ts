import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { linkUsersInGroup } from "@/lib/account-linking-db";

/**
 * Fallback account-linking handler.
 *
 * After an OAuth flow the JWT callback *tries* to link accounts by reading
 * the `linkFromUserId` cookie, but `cookies()` from `next/headers` can
 * silently fail inside NextAuth callbacks on certain Next.js versions.
 *
 * This route handler runs AFTER the OAuth callback completes and has
 * guaranteed access to request cookies via `req.cookies`.  If the JWT
 * callback already linked the accounts, this is a harmless no-op.
 */
export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from");
  const linkCookie = req.cookies.get("linkFromUserId")?.value;

  console.log("[finish-link] from:", from, "linkCookie:", linkCookie, "url:", req.url);
  console.log("[finish-link] all cookies:", req.cookies.getAll().map(c => c.name).join(", "));

  // Security: the URL param must match the httpOnly cookie to prove
  // the linking was initiated by an authenticated server action.
  if (!from || from !== linkCookie) {
    console.log("[finish-link] SECURITY CHECK FAILED — from/cookie mismatch. Redirecting to /profile");
    // Can't verify linking intent — just go to profile
    const res = NextResponse.redirect(new URL("/profile", req.url));
    // Clean up stale cookies if present
    if (linkCookie) res.cookies.delete("linkFromUserId");
    res.cookies.delete("linkRedirect");
    return res;
  }

  const session = await auth();
  console.log("[finish-link] session user:", session?.user?.id);
  if (!session?.user?.id) {
    console.log("[finish-link] No session — redirecting to /login");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const oauthUserId = session.user.id;
  let needsSwitch = false;

  if (from !== oauthUserId) {
    console.log("[finish-link] Different users — linking", from, "↔", oauthUserId);
    // Different users (different email on Discord vs credentials).
    // The JWT callback may have already linked — linkUsersInGroup is
    // idempotent (returns early if they share a group).
    try {
      await linkUsersInGroup(from, oauthUserId);
      console.log("[finish-link] linkUsersInGroup succeeded");
    } catch (err) {
      console.error("[finish-link] linking error:", err);
    }
    needsSwitch = true;
  } else {
    console.log("[finish-link] Same user (same-email case) — no DB linking needed here");
  }
  // Same-email case (from === oauthUserId): the adapter auto-linked the
  // Account to the existing user.  The JWT callback handles the
  // user-splitting logic which requires the `account` and `profile`
  // objects that only the JWT callback has access to.  If the JWT
  // callback succeeded, the session is already correct.  If it failed,
  // the Account is still on the existing user — functional but without
  // a separate linked identity.

  const redirectUrl = new URL("/profile", req.url);
  if (needsSwitch) {
    // Tell the client to switch the session back to the original user
    redirectUrl.searchParams.set("_switchTo", from);
  }

  console.log("[finish-link] redirecting to:", redirectUrl.toString());
  const res = NextResponse.redirect(redirectUrl);
  res.cookies.delete("linkFromUserId");
  res.cookies.delete("linkRedirect");
  return res;
}
