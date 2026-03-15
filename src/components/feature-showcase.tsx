"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

interface FeatureSection {
  title: string;
  description: string;
  screenshot: string;
  gradient: string;
  darkGradient: string;
  imageOnLeft: boolean;
}

const features: FeatureSection[] = [
  {
    title: "Express Yourself",
    description:
      "Customize your profile with themes, bios, and personality. Make your corner of the internet truly yours.",
    screenshot: "/screenshots/profile.svg",
    gradient: "from-fuchsia-600 to-purple-600",
    darkGradient: "dark:from-fuchsia-700 dark:to-purple-700",
    imageOnLeft: true,
  },
  {
    title: "Find Your People",
    description:
      "Discover communities built around shared interests. From niche hobbies to broad passions, there's a place for everyone.",
    screenshot: "/screenshots/communities.svg",
    gradient: "from-blue-600 to-cyan-600",
    darkGradient: "dark:from-blue-700 dark:to-cyan-700",
    imageOnLeft: false,
  },
  {
    title: "Explore by Tag",
    description:
      "Browse content through tags that actually work. No algorithm deciding what you see — just pure, chronological discovery.",
    screenshot: "/screenshots/tag.svg",
    gradient: "from-purple-600 to-fuchsia-600",
    darkGradient: "dark:from-purple-700 dark:to-fuchsia-700",
    imageOnLeft: true,
  },
  {
    title: "Share Your Thoughts",
    description:
      "Rich text, images, and formatting without the noise. Compose posts that say exactly what you mean.",
    screenshot: "/screenshots/compose.svg",
    gradient: "from-cyan-600 to-blue-600",
    darkGradient: "dark:from-cyan-700 dark:to-blue-700",
    imageOnLeft: false,
  },
  {
    title: "Real Conversations",
    description:
      "Direct messages that feel personal. Chat with friends in real time, with themes and style that match your vibe.",
    screenshot: "/screenshots/chat.svg",
    gradient: "from-fuchsia-600 to-blue-600",
    darkGradient: "dark:from-fuchsia-700 dark:to-blue-700",
    imageOnLeft: true,
  },
];

function useParallax(prefersReducedMotion: boolean) {
  const [offsets, setOffsets] = useState<number[]>([]);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  const updateOffsets = useCallback(() => {
    const viewportCenter = window.scrollY + window.innerHeight / 2;
    const newOffsets = sectionRefs.current.map((ref) => {
      if (!ref) return 0;
      const rect = ref.getBoundingClientRect();
      const sectionCenter = window.scrollY + rect.top + rect.height / 2;
      return (viewportCenter - sectionCenter) * 0.08;
    });
    setOffsets(newOffsets);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateOffsets();
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    // Initial calculation
    updateOffsets();
    return () => window.removeEventListener("scroll", onScroll);
  }, [prefersReducedMotion, updateOffsets]);

  return { sectionRefs, offsets };
}

export function FeatureShowcase() {
  const [visibleSections, setVisibleSections] = useState<Set<number>>(
    new Set(),
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const { sectionRefs, offsets } = useParallax(prefersReducedMotion);
  const observerRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = observerRefs.current.indexOf(
            entry.target as HTMLDivElement,
          );
          if (index !== -1 && entry.isIntersecting) {
            setVisibleSections((prev) => new Set([...prev, index]));
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    );

    const refs = observerRefs.current;
    refs.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      refs.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  return (
    <div className="relative overflow-x-clip">
      {features.map((feature, index) => {
        const isVisible = visibleSections.has(index);
        const shapeParallax = prefersReducedMotion
          ? 0
          : (offsets[index] ?? 0);
        const contentParallax = prefersReducedMotion
          ? 0
          : (offsets[index] ?? 0) * 0.5;

        return (
          <div
            key={index}
            ref={(el) => {
              sectionRefs.current[index] = el;
              observerRefs.current[index] = el;
            }}
            className="relative py-20 sm:py-28 md:py-36"
          >
            {/* Parallelogram background shape — covers full section with extra buffer */}
            <div
              className="absolute inset-x-0 -top-16 -bottom-16 -z-10 sm:-top-12 sm:-bottom-12"
              style={{
                transform: `translateY(${shapeParallax}px) skewY(-6deg)`,
              }}
            >
              <div
                className={`h-full w-full bg-gradient-to-r ${feature.gradient} ${feature.darkGradient} opacity-90 dark:opacity-80`}
              />
            </div>

            {/* Content container */}
            <div
              className={`showcase-section relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 sm:gap-12 md:gap-16 ${
                feature.imageOnLeft
                  ? "md:flex-row"
                  : "md:flex-row-reverse"
              }`}
              style={
                prefersReducedMotion
                  ? undefined
                  : {
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible
                        ? `translateY(${contentParallax}px)`
                        : `translateY(${contentParallax + 40}px)`,
                      transition:
                        "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                    }
              }
            >
              {/* Screenshot */}
              <div className="w-full flex-shrink-0 md:w-1/2">
                <div
                  className={`overflow-hidden rounded-2xl shadow-2xl shadow-black/20 ${
                    feature.imageOnLeft
                      ? "md:-rotate-2"
                      : "md:rotate-2"
                  } transition-transform duration-700`}
                >
                  <img
                    src={feature.screenshot}
                    alt={`${feature.title} feature preview`}
                    className="h-auto w-full"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Text content */}
              <div className="w-full text-center md:w-1/2 md:text-left">
                <h2 className="text-3xl tracking-tight text-white sm:text-4xl md:text-5xl">
                  {feature.title}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-white/80 sm:mt-6 sm:text-xl">
                  {feature.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Final CTA section */}
      <div className="relative z-10 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-blue-600 py-28 sm:py-36 dark:from-fuchsia-700 dark:via-purple-700 dark:to-blue-700">
        {/* Subtle top separator line */}
        <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-3xl tracking-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl">
            Ready to join?
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-white/90 drop-shadow-sm sm:text-xl">
            No algorithms. No AI feeds. Just people being people.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="w-full rounded-xl bg-white px-8 py-3.5 text-sm font-medium text-fuchsia-700 shadow-lg transition-colors hover:bg-zinc-50 sm:w-auto"
            >
              Create an Account
            </Link>
            <Link
              href="/login"
              className="w-full rounded-xl border border-white/30 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
