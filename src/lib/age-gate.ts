import { prisma } from "@/lib/prisma";

export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

export async function requireMinimumAge(
  userId: string,
  minAge: number
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dateOfBirth: true },
  });
  if (!user?.dateOfBirth) return false;
  return calculateAge(user.dateOfBirth) >= minAge;
}
