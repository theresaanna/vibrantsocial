import { redirect } from "next/navigation";

/**
 * Legacy redirect: /explore/chatrooms now lives at /chatrooms.
 */
export default function ExploreChatroomsRedirect() {
  redirect("/chatrooms");
}
