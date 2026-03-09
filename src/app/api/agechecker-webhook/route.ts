import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/agechecker";
import type { AgeCheckerWebhookPayload } from "@/lib/agechecker";

/**
 * AgeChecker.net webhook callback.
 * Receives PUT requests when a verification status changes (accepted or denied).
 */
export async function PUT(request: NextRequest) {
  const signature = request.headers.get("X-AgeChecker-Signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature" },
      { status: 401 }
    );
  }

  const bodyText = await request.text();

  if (!verifyWebhookSignature(bodyText, signature)) {
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  let payload: AgeCheckerWebhookPayload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const { uuid, status } = payload;

  if (!uuid || !status) {
    return NextResponse.json(
      { error: "Missing uuid or status" },
      { status: 400 }
    );
  }

  // Find the user associated with this verification UUID
  const user = await prisma.user.findFirst({
    where: { ageVerificationUuid: uuid },
    select: { id: true, ageVerified: true },
  });

  if (!user) {
    // UUID not found — may be from an old or unrelated verification
    return NextResponse.json({ received: true });
  }

  if (status === "accepted" && !user.ageVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { ageVerified: new Date() },
    });
  }

  // For denied status, we don't take action — user can retry
  // The reason is logged in AgeChecker's dashboard

  return NextResponse.json({ received: true });
}
