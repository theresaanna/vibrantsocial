import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/age-gate";
import { MarketplaceGrid } from "@/components/marketplace-grid";
import { MarketplaceClient } from "./marketplace-client";

import { fetchMarketplacePage } from "./media-actions";
import { isProfileIncomplete } from "@/lib/require-profile";

interface MarketplaceContentProps {
  userId?: string;
}

export async function MarketplaceContent({ userId }: MarketplaceContentProps) {
  const { posts, hasMore } = await fetchMarketplacePage();

  // Logged-out users: show the grid only
  if (!userId) {
    return <MarketplaceGrid initialPosts={posts} initialHasMore={hasMore} />;
  }

  // Logged-in users: show composer + grid
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      phoneVerified: true,
      dateOfBirth: true,
      ageVerified: true,
      username: true,
      email: true,
      isProfilePublic: true,
    },
  });

  if (!currentUser || isProfileIncomplete(currentUser)) {
    return null;
  }

  const phoneVerified = !!currentUser.phoneVerified;
  const isOldEnough = currentUser.dateOfBirth
    ? calculateAge(currentUser.dateOfBirth) >= 18
    : false;
  const isAgeVerified = !!currentUser.ageVerified;
  const isProfilePublic = currentUser.isProfilePublic;

  return (
    <>
      <div className="mb-4 rounded-2xl border border-pink-200 bg-pink-50 px-5 py-4 dark:border-pink-800 dark:bg-pink-950/30" data-testid="marketplace-notice">
        <div className="flex gap-3">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0020.01 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
          <div className="text-sm text-pink-900 dark:text-pink-200">
            <p className="font-semibold">Welcome to the Marketplace</p>
            <p className="mt-1 leading-relaxed text-pink-800 dark:text-pink-300">
              The marketplace welcomes anything you can ship or send digitally &mdash; as long as you own it or created it yourself, have full rights to sell it, and it is legal to sell both where you are and where it&apos;s being sold.
            </p>
          </div>
        </div>
      </div>
      <MarketplaceClient
        initialPosts={posts}
        initialHasMore={hasMore}
        phoneVerified={phoneVerified}
        isOldEnough={isOldEnough}
        isAgeVerified={isAgeVerified}
        isProfilePublic={isProfilePublic}
      />
    </>
  );
}
