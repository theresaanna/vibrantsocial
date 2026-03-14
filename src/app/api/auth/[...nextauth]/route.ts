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
          // Fetch ALL accounts for this provider (avoids Prisma relation
          // filter issues) and filter orphans in JavaScript.
          const allAccounts = await prisma.account.findMany({
            where: { provider },
            include: {
              user: { select: { id: true, email: true } },
            },
          });
          console.log(
            "[nextauth] All",
            provider,
            "accounts:",
            JSON.stringify(
              allAccounts.map((a) => ({
                accountId: a.id,
                userId: a.userId,
                email: a.user?.email ?? null,
              }))
            )
          );

          // Orphans = accounts whose user has no email (created by the
          // JWT callback's same-email splitting logic).
          const orphans = allAccounts.filter((a) => !a.user?.email);
          console.log("[nextauth] Orphans to delete:", orphans.length);

          for (const orphan of orphans) {
            console.log(
              "[nextauth] Deleting orphaned account:",
              orphan.id,
              "user:",
              orphan.userId
            );
            await prisma.account.delete({ where: { id: orphan.id } });
            const remaining = await prisma.account.count({
              where: { userId: orphan.userId },
            });
            if (remaining === 0) {
              await prisma.user
                .delete({ where: { id: orphan.userId } })
                .catch(() => {});
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
