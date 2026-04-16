import { redirect } from "next/navigation";

/**
 * Legacy redirect: /communities now lives at /explore.
 */
export default function CommunitiesRedirect() {
  redirect("/explore");
}
