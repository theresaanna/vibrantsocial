import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Learn how VibrantSocial uses cookies.",
};

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Cookie Policy
      </h1>
      <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
        Last updated: March 13, 2026
      </p>

      <p className="mt-8 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        VibrantSocial uses cookies strictly for authentication and essential site
        functionality. We do not use cookies for tracking, advertising, or
        analytics. We do not sell your data.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        1. What Cookies We Use
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            Session cookie:
          </strong>{" "}
          A JSON Web Token (JWT) that keeps you signed in. This cookie is
          HTTP-only and encrypted. It is removed when you sign out.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            CSRF token:
          </strong>{" "}
          A security token that protects against cross-site request forgery
          attacks during authentication.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            Account linking:
          </strong>{" "}
          A short-lived cookie (5 minutes) used during the OAuth account-linking
          flow to associate two accounts. It is automatically deleted after use.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            Theme preference:
          </strong>{" "}
          Your light or dark mode selection is stored in local storage (not a
          cookie) so it persists between visits.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        2. What We Do Not Do
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <li>We do not use tracking or advertising cookies.</li>
        <li>We do not sell, share, or trade your data with third parties.</li>
        <li>We do not use cookies to build user profiles for marketing.</li>
        <li>
          Embedded content such as YouTube videos uses privacy-enhanced mode
          (youtube-nocookie.com) to minimize third-party tracking.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        3. Managing Cookies
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        You can clear or block cookies through your browser settings at any time.
        Please note that disabling cookies will prevent you from signing in to
        VibrantSocial, as the session cookie is required for authentication.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        4. Contact
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        If you have questions about this Cookie Policy, please contact us at{" "}
        <a
          href="mailto:vibrantsocial@proton.me"
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          vibrantsocial@proton.me
        </a>
        .
      </p>

      <div className="mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          See also our{" "}
          <Link
            href="/privacy"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
