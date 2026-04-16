import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/age-gate";
import { MarketplaceGrid } from "@/components/marketplace-grid";
import { MarketplaceNotice } from "@/components/marketplace-notice";
import Link from "next/link";

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

  // Logged-in users: show notice + CTA + grid
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

  return (
    <>
      <MarketplaceNotice />
      <Link
        href="/marketplace/compose"
        className="mb-6 flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-bold shadow-lg transition-all hover:shadow-xl hover:brightness-110"
        style={{
          backgroundColor: "var(--profile-link, #d946ef)",
          color: "var(--profile-bg, #ffffff)",
        }}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Create a Listing
      </Link>
      <MarketplaceGrid initialPosts={posts} initialHasMore={hasMore} />
    </>
  );
}
