import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { apiLimiter, checkRateLimit } from "@/lib/rate-limit";
import { pushUnsubscribeSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(apiLimiter, `push-unsub:${session.user.id}`);
  if (rateLimited) return rateLimited;

  const body = await request.json();
  const parsed = pushUnsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { endpoint } = parsed.data;

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
