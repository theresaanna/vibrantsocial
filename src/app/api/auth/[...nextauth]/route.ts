import { handlers } from "@/auth";
import { linkCookieStore } from "@/lib/link-cookie-store";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Wrap the NextAuth handlers so the `linkFromUserId` cookie value is available
 * inside callbacks via AsyncLocalStorage, even if `cookies()` from
 * `next/headers` fails in that context.
 *
 * Also intercepts OAuthAccountNotLinked errors during linking flows to clean
 * up orphaned Account+User records from previous failed attempts, then
 * redirects to /profile so the user can retry.
 */
/**
 * Clean up orphaned Account+User records for a provider.
 * An orphan is an Account whose User has no passwordHash (OAuth-only artifact)
 * and is NOT the linking initiator.
 */
async function cleanupOrphanAccounts(provider: string, currentUserId: string) {
  const allAccounts = await prisma.account.findMany({
    where: { provider },
  });
  console.log("[nextauth:cleanup] Found", allAccounts.length, provider, "accounts");

  let deleted = 0;
  for (const acct of allAccounts) {
    if (acct.userId === currentUserId) continue;

    const owner = await prisma.user.findUnique({
      where: { id: acct.userId },
      select: { id: true, email: true, passwordHash: true },
    });
    console.log(
      "[nextauth:cleanup] Account", acct.id, "→ user:", acct.userId,
      "email:", owner?.email ?? "null",
      "hasPassword:", !!owner?.passwordHash
    );

    if (!owner || !owner.passwordHash) {
      console.log("[nextauth:cleanup] Deleting orphan account:", acct.id);
      await prisma.account.delete({ where: { id: acct.id } });
      deleted++;
      if (owner) {
        const remaining = await prisma.account.count({
          where: { userId: owner.id },
        });
        if (remaining === 0) {
          await prisma.user
            .delete({ where: { id: owner.id } })
            .catch(() => {});
          console.log("[nextauth:cleanup] Deleted orphan user:", owner.id);
        }
      }
    }
  }
  return deleted;
}

export async function GET(req: NextRequest) {
  const linkCookie = req.cookies.get("linkFromUserId")?.value;

  // PRE-CALLBACK CLEANUP: If this is a linking flow callback, clean up
  // orphans BEFORE Auth.js processes the request.  This prevents
  // OAuthAccountNotLinked from being thrown in the first place.
  if (linkCookie && req.nextUrl.pathname.includes("/callback/")) {
    const pathParts = req.nextUrl.pathname.split("/");
    const callbackIdx = pathParts.indexOf("callback");
    const provider = callbackIdx >= 0 ? pathParts[callbackIdx + 1] : null;

    if (provider) {
      console.log("[nextauth] Pre-callback orphan cleanup for provider:", provider, "user:", linkCookie);
      try {
        const deleted = await cleanupOrphanAccounts(provider, linkCookie);
        console.log("[nextauth] Pre-callback cleanup deleted", deleted, "orphans");
      } catch (err) {
        console.error("[nextauth] Pre-callback cleanup error:", err);
      }
    }
  }

  const response = await linkCookieStore.run(linkCookie, () =>
    handlers.GET!(req)
  );

  // POST-CALLBACK FALLBACK: If Auth.js still errored with
  // OAuthAccountNotLinked (shouldn't happen after pre-cleanup, but
  // just in case), clean up again and redirect to profile for retry.
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
        console.log("[nextauth] OAuthAccountNotLinked STILL occurred — running post-callback cleanup");
        try {
          await cleanupOrphanAccounts(provider, linkCookie);
        } catch (err) {
          console.error("[nextauth] Post-callback cleanup error:", err);
        }
      }

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
