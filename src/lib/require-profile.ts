import { prisma } from "@/lib/prisma";

/**
 * The fields a user object must include for the profile-completeness check.
 */
export type ProfileCheckUser = {
  username: string | null;
  email: string | null;
  dateOfBirth: Date | null;
} | null;

/**
 * Returns true if the user is missing any required profile fields
 * (username, email, dateOfBirth).
 * Use this with user objects already fetched from the DB.
 */
export function isProfileIncomplete(user: ProfileCheckUser): boolean {
  return !user?.username || !user?.email || !user?.dateOfBirth;
}

/**
 * DB-query version: check if a user has completed all required profile fields.
 * Returns "/complete-profile" if any required field is missing, null if complete.
 */
export async function checkProfileCompletion(
  userId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, email: true, dateOfBirth: true },
  });

  if (isProfileIncomplete(user)) return "/complete-profile";

  return null;
}
