-- Make PremiumComp.stripeSubscriptionId nullable so we can record
-- non-Stripe comps (premium granted directly via User.premiumExpiresAt).
ALTER TABLE "PremiumComp" ALTER COLUMN "stripeSubscriptionId" DROP NOT NULL;
