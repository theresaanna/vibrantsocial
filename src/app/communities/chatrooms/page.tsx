import { redirect } from "next/navigation";

/**
 * Legacy redirect: /communities/chatrooms now lives at /chatrooms.
 */
export default function CommunitiesChatroomsRedirect() {
  redirect("/chatrooms/lounge");
}
