import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function proxy(request: Request) {
  const session = await auth();
  const { pathname } = new URL(request.url);

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
