import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - VibrantSocial",
  description: "VibrantSocial Terms of Service",
};

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
        Last updated: March 7, 2026
      </p>

      <p className="mt-8 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        By creating an account or using VibrantSocial, you agree to these Terms
        of Service. If you do not agree, do not use the platform.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        1. Eligibility
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        You must be at least 18 years old to create an account or use
        VibrantSocial. By signing up, you confirm that you are 18 or older.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        2. Compliance with Laws
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        You are responsible for complying with all applicable laws in your
        jurisdiction, including but not limited to copyright, intellectual
        property, defamation, privacy, and export control laws. You may not use
        VibrantSocial to post, share, or distribute any content that violates
        applicable laws.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        3. Content Labeling Requirements
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        VibrantSocial requires accurate content labeling to keep the community
        safe and informed. All posts must be labeled using the following
        categories where applicable:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">Sensitive:</strong>{" "}
          Content with detailed or graphic mentions of suicide or self harm,
          drug or substance use, violence, media depicting bodily harm, or
          anything you suspect of being harmful to a wider audience.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">NSFW:</strong>{" "}
          Content dealing with or depicting adult topics but not outright
          graphic adult material or sexualized nudity. Nudity in artwork or
          general photography does not need to be marked NSFW. Use good
          judgment.
        </li>
        <li>
          <strong className="text-zinc-800 dark:text-zinc-200">
            Graphic/Explicit:
          </strong>{" "}
          Graphic descriptions of adult topics, media containing sexual acts,
          extreme violence, anything that is of great importance to be kept
          from minor or unwilling eyes.
        </li>
      </ul>
      <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Only users who biometrically age verify can see posts marked Sensitive
        and Graphic/Explicit. All users can opt into NSFW content, but it will
        not be shown publicly to users who are not logged into the platform.
        This is for the safety of everyone, including minors who must not see
        adult content.
      </p>
      <p className="mt-3 text-sm font-medium leading-relaxed text-red-600 dark:text-red-400">
        No illegal media or hate speech is allowed under any circumstances.
      </p>
      <p className="mt-3 text-sm font-medium leading-relaxed text-red-600 dark:text-red-400">
        Three failures to mark material Sensitive or Graphic/Explicit according
        to the guidelines above will result in deactivation of your account.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        4. Account Responsibility
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        You are responsible for all activity that occurs under your account. Keep
        your login credentials secure and notify us immediately if you suspect
        unauthorized access to your account.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        5. Termination
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        VibrantSocial reserves the right to suspend or terminate accounts that
        violate these Terms of Service, at our sole discretion and without prior
        notice.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        6. Contact
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        If you have questions about these Terms of Service, please contact us at{" "}
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
