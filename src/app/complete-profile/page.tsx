import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CompleteProfileForm } from "./complete-profile-form";

export default async function CompleteProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dateOfBirth: true },
  });

  if (user?.dateOfBirth) redirect("/feed");

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Complete Your Profile
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            We need your date of birth to continue.
          </p>
        </div>

        <CompleteProfileForm />
      </div>
    </div>
  );
}
