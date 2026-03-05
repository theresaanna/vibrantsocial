import { prisma } from "@/lib/prisma";

export async function requirePhoneVerification(
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phoneVerified: true },
  });
  return !!user?.phoneVerified;
}
