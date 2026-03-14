import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // After an OAuth account-linking flow, NextAuth may lose the callbackUrl
  // and redirect to "/" (which sends authenticated users to /feed).
  // The linkRedirect cookie, set by startOAuthLink alongside linkFromUserId,
  // tells us where the user should actually go.
  const linkRedirect = request.cookies.get("linkRedirect")?.value;
  if (linkRedirect) {
    const response = NextResponse.redirect(new URL(linkRedirect, request.url));
    response.cookies.delete("linkRedirect");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run middleware on all routes except:
     * - api (API routes, including NextAuth /api/auth/*)
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, sitemap.xml, robots.txt (static files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
