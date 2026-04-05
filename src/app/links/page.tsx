import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "VibrantSocial Links — A link page that won't betray your links",
  description:
    "Use your VibrantSocial app theme to give your links personality. Link to your website, social media accounts, tip methods, anything!",
  openGraph: {
    title: "VibrantSocial Links — A link page that won't betray your links",
    description:
      "Use your VibrantSocial app theme to give your links personality. Link to your website, social media accounts, tip methods, anything!",
    siteName: "VibrantSocial",
    type: "website",
  },
};

function MockLink({ children }: { children: React.ReactNode }) {
  return (
    <div className="block w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-sm font-medium text-white backdrop-blur-sm">
      {children}
    </div>
  );
}

function MockLinksPage({
  name,
  bio,
  links,
  gradient,
}: {
  name: string;
  bio: string;
  links: string[];
  gradient: string;
}) {
  return (
    <div
      className={`w-56 shrink-0 rounded-2xl ${gradient} px-4 py-6 shadow-lg`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur-sm" />
        <p className="text-sm font-semibold text-white">{name}</p>
        {bio && (
          <p className="text-center text-xs text-white/70">{bio}</p>
        )}
      </div>
      <div className="mt-4 space-y-2">
        {links.map((link) => (
          <MockLink key={link}>{link}</MockLink>
        ))}
      </div>
      <p className="mt-4 text-center text-[10px] text-white/40">
        vibrantsocial.app
      </p>
    </div>
  );
}

export default function LinksLandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl space-y-10 py-20 text-center">
          <div className="space-y-5">
            <h1 className="text-4xl leading-tight tracking-tight text-zinc-900 sm:text-5xl sm:leading-tight dark:text-zinc-50">
              A link page that won&apos;t betray your links
              {" "}to other apps.
            </h1>

            <p className="mx-auto max-w-lg text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">
              Use your{" "}
              <span className="font-medium">
                <span className="text-fuchsia-600 dark:text-fuchsia-400">
                  Vibrant
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  Social
                </span>
              </span>{" "}
              app theme to give your links personality. Link to your website,
              social media accounts, tip methods, anything!
            </p>
          </div>

          {/* Mock links pages showcase */}
          <div className="flex items-center justify-center gap-4 overflow-hidden py-4">
            <MockLinksPage
              name="Alex"
              bio="photographer & traveler"
              links={["Portfolio", "Instagram", "Buy me a coffee"]}
              gradient="bg-gradient-to-b from-emerald-600 to-teal-800"
            />
            <MockLinksPage
              name="Jordan"
              bio=""
              links={["My Store", "Twitch", "Twitter", "Tip Jar"]}
              gradient="bg-gradient-to-b from-fuchsia-600 to-purple-800"
            />
            <MockLinksPage
              name="Sam"
              bio="artist & musician"
              links={["Bandcamp", "Commission Info", "Patreon"]}
              gradient="bg-gradient-to-b from-amber-500 to-orange-700"
            />
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="https://www.vibrantsocial.app/signup"
              className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-blue-600 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500 sm:w-auto"
            >
              Create an Account
            </Link>
            <Link
              href="https://www.vibrantsocial.app/profile/links"
              className="w-full rounded-xl border border-fuchsia-200 px-8 py-3.5 text-sm font-medium text-fuchsia-700 transition-colors hover:bg-fuchsia-50 sm:w-auto dark:border-fuchsia-800 dark:text-fuchsia-300 dark:hover:bg-fuchsia-900/20"
            >
              Set Up Your Links
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="mx-auto max-w-3xl space-y-16">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
              Your links, your style
            </h2>
            <p className="mx-auto max-w-lg text-zinc-500 dark:text-zinc-400">
              No cookie-cutter templates. Your links page inherits your
              VibrantSocial profile theme &mdash; custom colors, background
              images, sparklefall, all of it.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-fuchsia-100 dark:bg-fuchsia-900/30">
                <svg
                  className="h-6 w-6 text-fuchsia-600 dark:text-fuchsia-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42"
                  />
                </svg>
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                Themed to you
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Your profile theme applies automatically. Change it once, it
                updates everywhere.
              </p>
            </div>

            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <svg
                  className="h-6 w-6 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                  />
                </svg>
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                In-app browser safe
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Sensitive links stay hidden from in-app browsers that might
                expose your history. We&apos;ll guide visitors to a real
                browser first.
              </p>
            </div>

            <div className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <svg
                  className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.1903 8.68842C13.6393 8.90291 14.0601 9.19611 14.432 9.56802C16.1893 11.3254 16.1893 14.1746 14.432 15.932L9.93198 20.432C8.17462 22.1893 5.32538 22.1893 3.56802 20.432C1.81066 18.6746 1.81066 15.8254 3.56802 14.068L5.32499 12.311M18.675 11.689L20.432 9.93198C22.1893 8.17462 22.1893 5.32538 20.432 3.56802C18.6746 1.81066 15.8254 1.81066 14.068 3.56802L9.56802 8.06802C7.81066 9.82538 7.81066 12.6746 9.56802 14.432C9.93992 14.8039 10.3607 15.0971 10.8097 15.3116"
                  />
                </svg>
              </div>
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                Link to anything
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Website, socials, tip jars, wishlists, commission pages &mdash;
                up to 50 links with custom titles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 py-16 text-center">
        <div className="mx-auto max-w-md space-y-5">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Ready to set up your links?
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sign up and visit your profile settings to get started.
          </p>
          <Link
            href="https://www.vibrantsocial.app/profile/links"
            className="inline-block rounded-xl bg-gradient-to-r from-fuchsia-600 to-blue-600 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:from-fuchsia-500 hover:to-blue-500"
          >
            Get Started
          </Link>
        </div>
      </section>
    </div>
  );
}
