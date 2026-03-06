import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";
import Link from "next/link";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      phoneNumber: true,
      phoneVerified: true,
      passwordHash: true,
      avatar: true,
      image: true,
    },
  });

  const isCredentialsUser = !!user?.passwordHash;
  const oauthImage = user?.image ?? session.user.image ?? null;

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Your Profile
        </h1>

        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Phone Verification
              </p>
              {user?.phoneVerified ? (
                <p className="text-sm text-green-600 dark:text-green-400">
                  Verified: {user.phoneNumber?.replace(/(\+\d{1,3})\d+(\d{4})/, "$1****$2")}
                </p>
              ) : (
                <p className="text-sm text-zinc-500">
                  {isCredentialsUser
                    ? "Verify your phone to secure your account"
                    : "Add a phone number for extra security"}
                </p>
              )}
            </div>
            {!user?.phoneVerified && (
              <Link
                href="/verify-phone"
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Verify
              </Link>
            )}
          </div>
        </div>

        <ProfileForm
          user={session.user}
          currentAvatar={user?.avatar ?? null}
          oauthImage={oauthImage}
        />
      </div>
    </div>
  );
}
