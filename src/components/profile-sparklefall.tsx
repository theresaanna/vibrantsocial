"use client";

import { useEffect, useRef } from "react";
import { SparkleFall } from "react-sparklefall";
import { toast } from "sonner";
import { parseJsonArray, SPARKLEFALL_DEFAULTS } from "@/lib/sparklefall-presets";
import { claimSparkleReward } from "@/app/profile/sparkle-reward-actions";

interface ProfileSparklefallProps {
  sparkles: string | null;
  colors: string | null;
  interval: number | null;
  wind: number | null;
  maxSparkles: number | null;
  minSize: number | null;
  maxSize: number | null;
  /**
   * When true (default), clicking a sparkle awards the viewer stars.
   * Disable for preview contexts like the theme editor.
   */
  rewardOnClick?: boolean;
}

// Injected once per page to override the library's `pointer-events: none`
// on individual sparkles. The container stays pointer-events:none so clicks
// on empty viewport space still pass through to the page underneath.
const STYLE_ID = "sparklefall-click-override";

function ensureClickStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .sparklefall-sparkle.sparklefall-clickable {
      pointer-events: auto !important;
      cursor: pointer;
      transition: transform 0.15s ease-out, opacity 0.2s ease-out;
    }
    .sparklefall-sparkle.sparklefall-popping {
      transform: scale(1.8) !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
}

export function ProfileSparklefall({
  sparkles,
  colors,
  interval,
  wind,
  maxSparkles,
  minSize,
  maxSize,
  rewardOnClick = true,
}: ProfileSparklefallProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Track whether we've already shown the "daily cap reached" toast this
  // session. We surface it once so the user knows the silent-fail is
  // intentional, then stay quiet on subsequent clicks so we don't nag.
  const capToastShownRef = useRef(false);

  // Tag newly-spawned sparkles as clickable via a MutationObserver — the
  // library spawns plain divs, so we opt each one in as it appears.
  useEffect(() => {
    if (!rewardOnClick) return;
    ensureClickStyle();

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const markClickable = (node: Element) => {
      if (node.classList.contains("sparklefall-sparkle")) {
        node.classList.add("sparklefall-clickable");
      }
    };

    // Tag any sparkles that already exist inside the wrapper.
    wrapper.querySelectorAll(".sparklefall-sparkle").forEach(markClickable);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node instanceof Element) markClickable(node);
        });
      }
    });
    observer.observe(wrapper, { childList: true, subtree: true });

    const onClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("sparklefall-sparkle")) return;
      if (target.classList.contains("sparklefall-popping")) return;

      // Pop animation — remove after the transition so the sparkle can't be
      // clicked twice. The library's own cleanup setTimeout will no-op.
      target.classList.add("sparklefall-popping");
      window.setTimeout(() => target.remove(), 200);

      claimSparkleReward()
        .then((result) => {
          if (result.ok) {
            toast.success(
              `🌟 +${result.awarded} star! ${result.total} total`
            );
            return;
          }
          // Show the "cap reached" toast once per session so the user
          // knows the silent pops after that are intentional, not broken.
          // Unauthorized (not logged in) stays fully silent — no point
          // nagging viewers who just don't have an account.
          if (result.error === "rate_limited" && !capToastShownRef.current) {
            capToastShownRef.current = true;
            toast.info(
              "✨ You've earned all your sparkle stars for today — come back tomorrow!"
            );
          }
        })
        .catch(() => {});
    };

    wrapper.addEventListener("click", onClick);
    return () => {
      observer.disconnect();
      wrapper.removeEventListener("click", onClick);
    };
  }, [rewardOnClick]);

  const parsedSparkles = parseJsonArray(sparkles) ?? ["✨", "⭐", "💫", "🌟"];
  const parsedColors = parseJsonArray(colors) ?? undefined;

  return (
    // Wrapper is pointer-events:none so empty viewport clicks pass through to
    // the page underneath. Individual sparkles override to pointer-events:auto.
    // aria-hidden because the rain is decorative — screen readers shouldn't
    // read out a stream of emoji characters.
    <div
      ref={wrapperRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      <SparkleFall
        sparkles={parsedSparkles}
        colors={parsedColors}
        interval={interval ?? SPARKLEFALL_DEFAULTS.interval}
        wind={wind ?? SPARKLEFALL_DEFAULTS.wind}
        maxSparkles={maxSparkles ?? SPARKLEFALL_DEFAULTS.maxSparkles}
        minSize={minSize ?? SPARKLEFALL_DEFAULTS.minSize}
        maxSize={maxSize ?? SPARKLEFALL_DEFAULTS.maxSize}
        zIndex={1}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
