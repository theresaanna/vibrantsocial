import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/age-gate";
import { ComposeClient } from "./compose-client";

export default async function ComposePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      phoneVerified: true,
      dateOfBirth: true,
    },
  });

  if (!currentUser?.dateOfBirth) redirect("/complete-profile");

  const phoneVerified = !!currentUser.phoneVerified;
  const isOldEnough = calculateAge(currentUser.dateOfBirth) >= 18;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <ComposeClient phoneVerified={phoneVerified} isOldEnough={isOldEnough} />
    </main>
  );
}
