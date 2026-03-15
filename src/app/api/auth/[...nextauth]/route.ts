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
export async function GET(req: NextRequest) {
  const linkCookie = req.cookies.get("linkFromUserId")?.value;
  const response = await linkCookieStore.run(linkCookie, () =>
    handlers.GET!(req)
  );

  // During a linking flow, if Auth.js redirected to the error page with
  // OAuthAccountNotLinked, clean up orphaned accounts so the next attempt
  // succeeds.
  //
  // The error occurs because Auth.js Scenario 1: the user IS signed in,
  // and the OAuth Account belongs to a different user (the orphan created
  // by the JWT callback's same-email splitting during a previous failed attempt).
  if (
    linkCookie &&
    response instanceof Response &&
    response.status >= 300 &&
    response.status < 400
  ) {
    const location = response.headers.get("location") ?? "";
    if (location.includes("OAuthAccountNotLinked")) {
      // Extract provider from callback URL (e.g. /api/auth/callback/discord)
      const pathParts = req.nextUrl.pathname.split("/");
      const callbackIdx = pathParts.indexOf("callback");
      const provider =
        callbackIdx >= 0 ? pathParts[callbackIdx + 1] : null;

      if (provider) {
        console.log(
          "[nextauth] OAuthAccountNotLinked during linking flow — cleaning up orphans for provider:",
          provider
        );
        try {
          // Use separate queries (no nested include/select) for PrismaPg
          // driver adapter compatibility.
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

            if (!owner || !owner.passwordHash) {
              console.log("[nextauth] Deleting orphan account:", acct.id);
              await prisma.account.delete({ where: { id: acct.id } });
              if (owner) {
                const remaining = await prisma.account.count({
                  where: { userId: owner.id },
                });
                if (remaining === 0) {
                  await prisma.user
                    .delete({ where: { id: owner.id } })
                    .catch(() => {});
                  console.log("[nextauth] Deleted orphan user:", owner.id);
                }
              }
            }
          }
        } catch (err) {
          console.error("[nextauth] Orphan cleanup error:", err);
        }
      }

      // Redirect to profile instead of error page — user can retry
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
