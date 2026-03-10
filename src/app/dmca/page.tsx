import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DMCA Takedown Policy - VibrantSocial",
  description: "VibrantSocial DMCA Takedown Policy",
};

export default function DMCAPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        DMCA Takedown Policy
      </h1>
      <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
        Last updated: March 10, 2026
      </p>

      <p className="mt-8 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        VibrantSocial respects the intellectual property rights of others and
        expects its users to do the same. In accordance with the Digital
        Millennium Copyright Act of 1998 (DMCA), we will respond promptly to
        notices of alleged copyright infringement that comply with the DMCA and
        are properly submitted to our designated agent.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        1. Filing a Takedown Notice
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        If you believe that content hosted on VibrantSocial infringes your
        copyright, please submit a written notice to our designated agent at{" "}
        <a
          href="mailto:vibrantsocial@proton.me"
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          vibrantsocial@proton.me
        </a>{" "}
        with the subject line &ldquo;DMCA Takedown Request.&rdquo; Your notice
        must include the following:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <li>
          A physical or electronic signature of the copyright owner or a person
          authorized to act on their behalf.
        </li>
        <li>
          Identification of the copyrighted work claimed to have been infringed.
        </li>
        <li>
          Identification of the material that is claimed to be infringing,
          including a URL or other specific location on VibrantSocial where the
          material can be found.
        </li>
        <li>
          Your contact information, including your name, address, telephone
          number, and email address.
        </li>
        <li>
          A statement that you have a good faith belief that the use of the
          material is not authorized by the copyright owner, its agent, or the
          law.
        </li>
        <li>
          A statement, made under penalty of perjury, that the information in
          the notice is accurate and that you are the copyright owner or
          authorized to act on the copyright owner&apos;s behalf.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        2. Counter-Notification
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        If you believe your content was removed or disabled by mistake or
        misidentification, you may submit a counter-notification to{" "}
        <a
          href="mailto:vibrantsocial@proton.me"
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          vibrantsocial@proton.me
        </a>{" "}
        with the subject line &ldquo;DMCA Counter-Notification.&rdquo; Your
        counter-notification must include the following:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <li>Your physical or electronic signature.</li>
        <li>
          Identification of the material that was removed or disabled, and the
          location where it previously appeared on VibrantSocial.
        </li>
        <li>
          A statement under penalty of perjury that you have a good faith belief
          the material was removed or disabled as a result of mistake or
          misidentification.
        </li>
        <li>
          Your name, address, and telephone number, and a statement that you
          consent to the jurisdiction of the federal district court for the
          judicial district in which your address is located, and that you will
          accept service of process from the person who filed the original DMCA
          notice.
        </li>
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Upon receiving a valid counter-notification, we will forward it to the
        original complainant. If the complainant does not notify us within 10
        business days that they have filed a court action, we may restore the
        removed content.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        3. Repeat Infringers
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        VibrantSocial will terminate the accounts of users who are determined to
        be repeat infringers in appropriate circumstances and at our sole
        discretion.
      </p>

      <h2 className="mt-10 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        4. Contact
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        For all DMCA-related inquiries, please contact our designated agent
        at{" "}
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
          </Link>{" "}
          and{" "}
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
