"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

interface CompleteProfileState {
  success: boolean;
  message: string;
}

export async function completeProfile(
  _prevState: CompleteProfileState,
  formData: FormData
): Promise<CompleteProfileState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, message: "Not authenticated" };
  }

  const dateOfBirthStr = formData.get("dateOfBirth") as string;
  if (!dateOfBirthStr) {
    return { success: false, message: "Date of birth is required" };
  }

  const dateOfBirth = new Date(dateOfBirthStr);
  if (isNaN(dateOfBirth.getTime())) {
    return { success: false, message: "Invalid date of birth" };
  }

  if (dateOfBirth > new Date()) {
    return { success: false, message: "Date of birth cannot be in the future" };
  }

  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }

  if (age < 13) {
    return { success: false, message: "You must be at least 13 years old" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { dateOfBirth },
  });

  redirect("/feed");
}
