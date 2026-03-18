import { prisma } from "@/lib/prisma";

export async function requireNotSuspended(
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspended: true },
  });
  return !user?.suspended;
}
