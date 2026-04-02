import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // Detect links subdomain (links.vibrantsocial.app or links.localhost:3000)
  if (host.startsWith("links.")) {
    const { pathname } = request.nextUrl;

    // Skip Next.js internals and static assets
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname === "/favicon.ico"
    ) {
      return NextResponse.next();
    }

    // Rewrite /username to /links/username
    const url = request.nextUrl.clone();
    url.pathname = `/links${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
