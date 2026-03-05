import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");

  if (!username) {
    return NextResponse.json({ available: false }, { status: 400 });
  }

  // Validate format: 3-30 chars, alphanumeric + underscores
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return NextResponse.json({ available: false });
  }

  const session = await auth();
  const currentUserId = session?.user?.id;

  const existing = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: { id: true },
  });

  // Available if no one has it, or the current user owns it
  const available = !existing || existing.id === currentUserId;

  return NextResponse.json({ available });
}
