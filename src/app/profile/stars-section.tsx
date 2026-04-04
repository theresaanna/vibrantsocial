"use client";

import { useState } from "react";
import { toast } from "sonner";

interface StarsSectionProps {
  stars: number;
  starsSpent: number;
  referralCode: string;
}

export function StarsSection({ stars, starsSpent, referralCode }: StarsSectionProps) {
  const [showStarsPopup, setShowStarsPopup] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowStarsPopup(true)}
          className="flex items-center gap-2 focus:outline-none"
          data-testid="stars-count"
        >
          <span
            className="relative inline-flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              backgroundImage: "url(/star.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
            }}
          >
            <span className="relative text-xs font-bold text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
              {stars}
            </span>
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {stars} {stars === 1 ? "star" : "stars"}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tap to learn more
            </p>
          </div>
        </button>
        {stars >= 500 && (
          <button
            type="button"
            disabled={redeeming}
            onClick={async () => {
              setRedeeming(true);
              try {
                const res = await fetch("/api/redeem-stars", { method: "POST" });
                const data = await res.json();
                if (res.ok) {
                  toast.success("Premium activated! Enjoy your free month.");
                  window.location.reload();
                } else {
                  toast.error(data.error || "Failed to redeem stars");
                }
              } catch {
                toast.error("Something went wrong");
              } finally {
                setRedeeming(false);
              }
            }}
            className="rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            data-testid="redeem-stars"
          >
            {redeeming ? "Redeeming..." : "Redeem for Premium"}
          </button>
        )}
      </div>
      <div className="mt-3 flex gap-4 border-t border-zinc-100 pt-3 dark:border-zinc-700">
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{stars + starsSpent}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Lifetime</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{starsSpent}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Spent</p>
        </div>
      </div>
      {referralCode && (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-700">
          <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">Your referral link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" data-testid="referral-link">
              {typeof window !== "undefined" ? `${window.location.origin}/signup?ref=${referralCode}` : `/signup?ref=${referralCode}`}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/signup?ref=${referralCode}`
                );
                setReferralCopied(true);
                setTimeout(() => setReferralCopied(false), 2000);
              }}
              className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {referralCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {showStarsPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowStarsPopup(false)}>
          <div
            className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">How to Earn Stars</h3>
              <button
                type="button"
                onClick={() => setShowStarsPopup(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                &times;
              </button>
            </div>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
              Stars are earned by being active on VibrantSocial. The more you engage, the more stars you collect!
            </p>
            <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              <li className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                Posting new content
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                Commenting on posts
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                Liking posts
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                Reposting content
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
                Referring new users
              </li>
            </ul>
            <div className="mt-4 rounded-lg bg-zinc-100 p-3 dark:bg-zinc-700">
              <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">Redeem stars</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Collect 500 stars to exchange for a free month of premium!
              </p>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-zinc-100 py-2 dark:bg-zinc-700">
              <span
                className="relative inline-flex items-center justify-center"
                style={{
                  width: 28,
                  height: 28,
                  backgroundImage: "url(/star.png)",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                }}
              >
                <span className="relative text-[10px] font-bold text-white" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                  {stars}
                </span>
              </span>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                You have {stars} {stars === 1 ? "star" : "stars"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
