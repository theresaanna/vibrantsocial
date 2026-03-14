import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function proxy(request: Request) {
  const { pathname } = new URL(request.url);

  // After an OAuth account-linking flow, NextAuth may lose the callbackUrl
  // and redirect to "/" (→ /feed).  The linkRedirect cookie, set alongside
  // linkFromUserId in startOAuthLink, tells us where the user should go.
  //
  // Only consume the cookie when `linkFromUserId` is absent — that means
  // the JWT callback has already processed the linking (or we've returned
  // from the OAuth provider).  While `linkFromUserId` is still present the
  // user hasn't left for the OAuth provider yet, so eating the cookie now
  // would lose the redirect target.
  const rawCookies = request.headers.get("cookie") ?? "";
  const linkRedirectMatch = rawCookies.match(
    /(?:^|;\s*)linkRedirect=([^;]*)/
  );
  const hasLinkFromUserId = /(?:^|;\s*)linkFromUserId=/.test(rawCookies);
  if (linkRedirectMatch && !hasLinkFromUserId) {
    const target = decodeURIComponent(linkRedirectMatch[1]);
    const targetPath = new URL(target, request.url).pathname;
    if (pathname !== targetPath) {
      const response = NextResponse.redirect(new URL(target, request.url));
      response.cookies.delete("linkRedirect");
      return response;
    }
    // Already at the target — just clean up the cookie
    const response = NextResponse.next();
    response.cookies.delete("linkRedirect");
    return response;
  }

  const session = await auth();

  const protectedPaths = ["/profile", "/settings", "/feed", "/verify-phone"];
  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const authPaths = ["/login", "/signup"];
  if (authPaths.some((p) => pathname === p) && session) {
    return NextResponse.redirect(new URL("/feed", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
