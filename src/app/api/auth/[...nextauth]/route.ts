import { handlers } from "@/auth";
import { linkCookieStore } from "@/lib/link-cookie-store";
import { linkUsersInGroup } from "@/lib/account-linking-db";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Wrap the NextAuth handlers so the `linkFromUserId` cookie value is available
 * inside callbacks via AsyncLocalStorage, even if `cookies()` from
 * `next/headers` fails in that context.
 *
 * Also handles the case where the OAuth Account already belongs to another
 * user by linking the two users directly.
 */
export async function GET(req: NextRequest) {
  const linkCookie = req.cookies.get("linkFromUserId")?.value;

  // PRE-CALLBACK: If this is a linking flow callback, check for conflicts
  // BEFORE Auth.js processes the request.
  if (linkCookie && req.nextUrl.pathname.includes("/callback/")) {
    const pathParts = req.nextUrl.pathname.split("/");
    const callbackIdx = pathParts.indexOf("callback");
    const provider = callbackIdx >= 0 ? pathParts[callbackIdx + 1] : null;

    if (provider) {
      console.log("[nextauth] Pre-callback check for provider:", provider, "linkingUser:", linkCookie);
      try {
        const allAccounts = await prisma.account.findMany({
          where: { provider },
        });
        console.log("[nextauth] Found", allAccounts.length, provider, "accounts");

        for (const acct of allAccounts) {
          if (acct.userId === linkCookie) continue;

          const owner = await prisma.user.findUnique({
            where: { id: acct.userId },
            select: { id: true, email: true, passwordHash: true },
          });
          console.log(
            "[nextauth] Account", acct.id, "→ user:", acct.userId,
            "email:", owner?.email ?? "null",
            "hasPassword:", !!owner?.passwordHash
          );

          if (owner) {
            // Account belongs to an existing user — link directly
            console.log("[nextauth] Account belongs to user — linking", linkCookie, "↔", owner.id);
            await linkUsersInGroup(linkCookie, owner.id);
            console.log("[nextauth] linkUsersInGroup succeeded");

            const profileUrl = new URL("/profile", req.url);
            profileUrl.searchParams.set("_switchTo", linkCookie);
            const res = NextResponse.redirect(profileUrl);
            res.cookies.delete("linkFromUserId");
            res.cookies.delete("linkRedirect");
            return res;
          }
          // No owner — Account is truly orphaned (dangling FK), skip it
          console.log("[nextauth] Skipping orphan account (no owner):", acct.id);
        }
      } catch (err) {
        console.error("[nextauth] Pre-callback error:", err);
      }
    }
  }

  const response = await linkCookieStore.run(linkCookie, () =>
    handlers.GET!(req)
  );

  // POST-CALLBACK FALLBACK: If Auth.js errored with OAuthAccountNotLinked,
  // try to link the users directly.
  if (
    linkCookie &&
    response instanceof Response &&
    response.status >= 300 &&
    response.status < 400
  ) {
    const location = response.headers.get("location") ?? "";
    if (location.includes("OAuthAccountNotLinked")) {
      const pathParts = req.nextUrl.pathname.split("/");
      const callbackIdx = pathParts.indexOf("callback");
      const provider =
        callbackIdx >= 0 ? pathParts[callbackIdx + 1] : null;

      if (provider) {
        console.log("[nextauth] OAuthAccountNotLinked — attempting direct link for provider:", provider);
        try {
          const conflictAccount = await prisma.account.findFirst({
            where: { provider, userId: { not: linkCookie } },
          });
          if (conflictAccount) {
            const owner = await prisma.user.findUnique({
              where: { id: conflictAccount.userId },
              select: { id: true },
            });
            if (owner) {
              // Link the users (works for both password and OAuth-only users)
              await linkUsersInGroup(linkCookie, owner.id);
              console.log("[nextauth] Post-callback: linked", linkCookie, "↔", owner.id);
              const profileUrl = new URL("/profile", req.url);
              profileUrl.searchParams.set("_switchTo", linkCookie);
              const res = NextResponse.redirect(profileUrl);
              res.cookies.delete("linkFromUserId");
              res.cookies.delete("linkRedirect");
              return res;
            }
          }
        } catch (err) {
          console.error("[nextauth] Post-callback link error:", err);
        }
      }

      // Fallback: redirect to profile with retry
      const profileUrl = new URL("/profile", req.url);
      profileUrl.searchParams.set("linkError", "retry");
      const res = NextResponse.redirect(profileUrl);
      res.cookies.delete("linkFromUserId");
      res.cookies.delete("linkRedirect");
      return res;
    }
  }

  return response;
}

export function POST(req: NextRequest) {
  const linkCookie = req.cookies.get("linkFromUserId")?.value;
  return linkCookieStore.run(linkCookie, () => handlers.POST!(req));
}
