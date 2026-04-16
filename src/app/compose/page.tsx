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
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "var(--profile-link, #d946ef)" }}>
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Compose</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Compose a post for your feed</p>
        </div>
      </div>
      <ComposeClient phoneVerified={phoneVerified} isOldEnough={isOldEnough} isPremium={isPremium} isAgeVerified={isAgeVerified} />
      {isPremium && <ScheduledPostsList posts={serializedScheduled} />}
    </ThemedPage>
  );
}
