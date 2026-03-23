import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function proxy(request: Request) {
  const { pathname } = new URL(request.url);

  // After an OAuth account-linking flow, NextAuth may lose the callbackUrl
  // and redirect to "/" (→ /feed).  The linkRedirect cookie, set alongside
  // linkFromUserId in startOAuthLink, tells us where the user should go
  // (the /api/finish-link handler).
  const rawCookies = request.headers.get("cookie") ?? "";
  const linkRedirectMatch = rawCookies.match(
    /(?:^|;\s*)linkRedirect=([^;]*)/
  );
  if (linkRedirectMatch) {
    const target = decodeURIComponent(linkRedirectMatch[1]);
    // Prevent open redirect: only allow relative paths starting with /
    if (target.startsWith("/") && !target.startsWith("//")) {
      const response = NextResponse.redirect(new URL(target, request.url));
      response.cookies.delete("linkRedirect");
      return response;
    }
    // Invalid redirect target, clear cookie and continue
    const response = NextResponse.next();
    response.cookies.delete("linkRedirect");
    return response;
  }

  const session = await auth();

  const protectedPaths = [
    "/profile",
    "/settings",
    "/feed",
    "/verify-phone",
    "/compose",
    "/chat",
    "/bookmarks",
    "/likes",
    "/notifications",
    "/friend-requests",
    "/close-friends",
    "/search",
    "/payment",
    "/age-verify",
    "/complete-profile",
  ];
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
