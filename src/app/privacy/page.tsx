import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read the VibrantSocial Privacy Policy.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
        Last updated: March 7, 2026
      </p>

      <p className="mt-8 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        VibrantSocial is committed to protecting your privacy. This policy
        explains what information we collect, how we use it, and your rights
        regarding your data.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        1. Information We Collect
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        When you use VibrantSocial, we collect the following information:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            Account information:
          </strong>{" "}
          Email address, username, date of birth, and profile avatar.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            Content you create:
          </strong>{" "}
          Posts, comments, direct messages, and uploaded media.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            OAuth profile data:
          </strong>{" "}
          If you sign in with Google or Discord, we receive your name, email
          address, and profile image from those services.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        2. How We Use Your Information
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <li>Account creation and authentication</li>
        <li>
          Enabling social features such as posts, comments, messaging, and
          follows
        </li>
        <li>
          Sending email notifications for comments, new messages, and mentions
          (configurable in your profile settings)
        </li>
        <li>Delivering real-time messaging</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        3. Authentication
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        You can sign up with an email and password or through Google or Discord
        OAuth. If you use email and password, your password is hashed with bcrypt
        and is never stored in plain text. We never have access to your
        plain-text password.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        4. Cookies
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        VibrantSocial does not use cookies for tracking or advertising. Session
        management uses JSON Web Tokens (JWTs). Embedded content such as YouTube
        videos uses privacy-enhanced modes (youtube-nocookie.com) to minimize
        third-party tracking.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        5. Third-Party Services
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        We use the following third-party services to operate VibrantSocial:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            Google &amp; Discord OAuth:
          </strong>{" "}
          For optional sign-in authentication.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">Ably:</strong>{" "}
          For real-time messaging infrastructure.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">Resend:</strong>{" "}
          For transactional email delivery.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">Twilio:</strong>{" "}
          For phone number verification.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">Vercel:</strong>{" "}
          For hosting and media file storage.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        6. Data Storage
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Your data is stored in a PostgreSQL database. Uploaded media files
        (avatars, images) are stored via Vercel Blob storage.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        7. Your Rights
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        You can update your profile information and control your email
        notification preferences at any time from your profile settings. If you
        wish to request deletion of your account and data, please contact us.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        8. Contact
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        If you have questions or concerns about this Privacy Policy, please
        contact us at{" "}
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
            href="/tos"
            className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
