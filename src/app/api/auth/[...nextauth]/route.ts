import { handlers } from "@/auth";
import { linkCookieStore } from "@/lib/link-cookie-store";
import { NextRequest } from "next/server";

/**
 * Wrap the NextAuth handlers so the `linkFromUserId` cookie value is available
 * inside callbacks via AsyncLocalStorage, even if `cookies()` from
 * `next/headers` fails in that context.
 */
export function GET(req: NextRequest) {
  const linkCookie = req.cookies.get("linkFromUserId")?.value;
  return linkCookieStore.run(linkCookie, () => handlers.GET!(req));
}

export function POST(req: NextRequest) {
  const linkCookie = req.cookies.get("linkFromUserId")?.value;
  return linkCookieStore.run(linkCookie, () => handlers.POST!(req));
}
