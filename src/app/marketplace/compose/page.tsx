import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/age-gate";
import { isProfileIncomplete } from "@/lib/require-profile";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";
import { MarketplaceNotice } from "@/components/marketplace-notice";
import { MarketplaceComposeClient } from "./marketplace-compose-client";

export const metadata: Metadata = {
  title: "Create Listing - Marketplace",
  robots: { index: false, follow: false },
};

export default async function MarketplaceComposePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      ...userThemeSelect,
      phoneVerified: true,
      dateOfBirth: true,
      ageVerified: true,
      username: true,
      email: true,
      isProfilePublic: true,
    },
  });
  if (!user) redirect("/login");
  if (isProfileIncomplete(user)) redirect("/marketplace");

  const theme = buildUserTheme(user);
  const phoneVerified = !!user.phoneVerified;
  const isOldEnough = user.dateOfBirth
    ? calculateAge(user.dateOfBirth) >= 18
    : false;
  const isAgeVerified = !!user.ageVerified;
  const isProfilePublic = user.isProfilePublic;

  return (
    <ThemedPage {...theme}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--profile-link, #d946ef)" }}>
          <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020.01 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Create Listing
        </h1>
      </div>
      <MarketplaceNotice />
      <MarketplaceComposeClient
        phoneVerified={phoneVerified}
        isOldEnough={isOldEnough}
        isAgeVerified={isAgeVerified}
        isProfilePublic={isProfilePublic}
      />
    </ThemedPage>
  );
}
