import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { VerifyPhoneForm } from "./verify-phone-form";

export default async function VerifyPhonePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Verify your phone
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Add a phone number to secure your account
          </p>
        </div>

        <VerifyPhoneForm />
      </div>
    </div>
  );
}
