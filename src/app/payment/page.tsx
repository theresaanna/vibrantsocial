import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isProfileIncomplete } from "@/lib/require-profile";
import { PaymentForm } from "./payment-form";

export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    session_id?: string;
    canceled?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      username: true,
      email: true,
      dateOfBirth: true,
      ageVerified: true,
      ageVerificationPaid: true,
    },
  });

  if (isProfileIncomplete(user)) redirect("/complete-profile");
  if (user.ageVerified) redirect("/profile");
  if (user.ageVerificationPaid) redirect("/age-verify");

  const params = await searchParams;

  // Handle Stripe redirect back after successful payment.
  // The webhook may not have fired yet, so verify the session server-side.
  if (params.success === "true" && params.session_id) {
    let paid = false;
    const { getCheckoutSession } = await import("@/lib/stripe");
    try {
      const checkoutSession = await getCheckoutSession(params.session_id);
      if (
        checkoutSession.payment_status === "paid" &&
        checkoutSession.client_reference_id === session.user.id
      ) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            ageVerificationPaid: new Date(),
            stripeCheckoutSessionId: checkoutSession.id,
          },
        });
        paid = true;
      }
    } catch {
      // If session retrieval fails, fall through to show payment page
    }
    if (paid) redirect("/age-verify");
  }

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Age Verification Fee
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            A one-time fee of $2.99 is required before age verification. This
            covers the cost of identity verification processing through
            AgeChecker.net.
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            This fee is non-refundable regardless of the outcome of age
            verification.
          </p>
        </div>

        <PaymentForm canceled={params.canceled === "true"} />
      </div>
    </div>
  );
}
