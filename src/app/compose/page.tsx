import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/age-gate";
import { ComposeClient } from "./compose-client";
import { isProfileIncomplete } from "@/lib/require-profile";
import { userThemeSelect, buildUserTheme } from "@/lib/user-theme";
import { ThemedPage } from "@/components/themed-page";
import { getScheduledPosts } from "./schedule-actions";
import { ScheduledPostsList } from "./scheduled-posts";

export const metadata: Metadata = {
  title: "Compose",
  robots: { index: false, follow: false },
};

export default async function ComposePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [currentUser, scheduledPosts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        username: true,
        email: true,
        phoneVerified: true,
        dateOfBirth: true,
        ageVerified: true,
        ...userThemeSelect,
      },
    }),
    getScheduledPosts(),
  ]);

  if (!currentUser || isProfileIncomplete(currentUser)) redirect("/complete-profile");

  const phoneVerified = !!currentUser.phoneVerified;
  const isOldEnough = calculateAge(currentUser.dateOfBirth!) >= 18;
  const isPremium = currentUser.tier === "premium";
  const isAgeVerified = !!currentUser.ageVerified;
  const theme = buildUserTheme(currentUser);

  const serializedScheduled = JSON.parse(JSON.stringify(scheduledPosts));

  return (
    <ThemedPage {...theme}>
      <ComposeClient phoneVerified={phoneVerified} isOldEnough={isOldEnough} isPremium={isPremium} isAgeVerified={isAgeVerified} />
      {isPremium && <ScheduledPostsList posts={serializedScheduled} />}
    </ThemedPage>
  );
}
