import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      dateOfBirth: true,
      phoneNumber: true,
      phoneVerified: true,
      passwordHash: true,
      avatar: true,
      image: true,
      profileBgColor: true,
      profileTextColor: true,
      profileLinkColor: true,
      profileSecondaryColor: true,
      profileContainerColor: true,
      biometricVerified: true,
      showNsfwByDefault: true,
    },
  });

  if (!user?.dateOfBirth) redirect("/complete-profile");

  const isCredentialsUser = !!user?.passwordHash;
  const oauthImage = user?.image ?? session.user.image ?? null;

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Your Profile
        </h1>

        <ProfileForm
          user={{
            ...session.user,
            profileBgColor: user?.profileBgColor ?? null,
            profileTextColor: user?.profileTextColor ?? null,
            profileLinkColor: user?.profileLinkColor ?? null,
            profileSecondaryColor: user?.profileSecondaryColor ?? null,
            profileContainerColor: user?.profileContainerColor ?? null,
          }}
          currentAvatar={user?.avatar ?? null}
          oauthImage={oauthImage}
          biometricVerified={!!user?.biometricVerified}
          showNsfwByDefault={user?.showNsfwByDefault ?? false}
          phoneVerified={!!user?.phoneVerified}
          phoneNumber={user?.phoneNumber ?? null}
          isCredentialsUser={isCredentialsUser}
        />

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
