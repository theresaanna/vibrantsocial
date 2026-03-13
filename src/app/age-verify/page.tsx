import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isProfileIncomplete } from "@/lib/require-profile";
import { AgeVerifyForm } from "./age-verify-form";

export const metadata: Metadata = {
  title: "Age Verification",
  robots: { index: false, follow: false },
};

export default async function AgeVerifyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      username: true,
      dateOfBirth: true,
      ageVerified: true,
      ageVerificationPaid: true,
      email: true,
    },
  });

  if (!user || isProfileIncomplete(user)) redirect("/complete-profile");
  if (user.ageVerified) redirect("/profile");
  if (!user.ageVerificationPaid) redirect("/payment");

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Verify your age
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Age verification is required to view sensitive and graphic content.
            Your information is processed securely through AgeChecker.net.
          </p>
        </div>

        <AgeVerifyForm existingEmail={user.email ?? undefined} />
      </div>
    </div>
  );
}
