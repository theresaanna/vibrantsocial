import type { Metadata } from "next";
import { auth } from "@/auth";
import { SubscribeButton } from "./subscribe-button";
import { ManageButton } from "./manage-button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Premium",
  description: "Unlock premium features to customize your profile and stand out.",
};

const features = [
  {
    title: "Custom Profile Themes",
    description:
      "Choose your own colors for text, links, backgrounds, and containers to make your profile uniquely yours.",
  },
  {
    title: "Profile Picture Frames",
    description:
      "Add eye-catching frames to your profile picture with a variety of styles and colors.",
  },
  {
    title: "Custom Backgrounds",
    description:
      "Upload your own background image and fine-tune how it displays on your profile page.",
  },
  {
    title: "Custom Audience",
    description:
      "Control exactly who sees your posts with custom audience lists.",
  },
  {
    title: "And More",
    description:
      "Discover delightful surprises and exclusive features waiting for you as a premium member.",
  },
];

export default async function PremiumPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user?.id;
  const isPremium = session?.user?.tier === "premium";

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-lg">
            <svg
              className="h-7 w-7 text-white"
              viewBox="1 0 22 24"
              fill="currentColor"
            >
              <path d="M2 19h20v3H2v-3zm1-1L12 4l4.5 7L22 5v13H2V18z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Premium
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Stand out with profile customization and exclusive features.
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
          {features.map((feature) => (
            <div key={feature.title} className="flex gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <svg
                  className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Action area */}
        <div className="rounded-2xl bg-white p-6 shadow-lg dark:bg-zinc-900">
          {isPremium ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  ✓ Premium Member
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                You have access to all premium features. Manage your subscription below.
              </p>
              <ManageButton />
            </div>
          ) : isLoggedIn ? (
            <SubscribeButton />
          ) : (
            <div className="space-y-3">
              <Link
                href="/login"
                className="block w-full rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
              >
                Log in to subscribe
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
