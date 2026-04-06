import { getUnreadNotificationCount } from "@/app/notifications/actions";
import { NextResponse } from "next/server";

export async function GET() {
  const count = await getUnreadNotificationCount();
  return NextResponse.json({ count });
}
