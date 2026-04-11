import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/mobile-auth";
import { corsJson, handleCorsPreflightRequest } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return handleCorsPreflightRequest(req);
}

export async function POST(req: Request) {
  const session = await getSessionFromRequest(req);
  if (!session?.user?.id) {
    return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return corsJson(req,
      { success: false, message: "Current password and new password are required" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return corsJson(req,
      { success: false, message: "New password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user?.passwordHash) {
    return corsJson(req,
      { success: false, message: "Your account uses social login. Password cannot be changed here." },
      { status: 400 }
    );
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return corsJson(req,
      { success: false, message: "Current password is incorrect" },
      { status: 400 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash },
  });

  return corsJson(req, { success: true, message: "Password changed successfully" });
}
