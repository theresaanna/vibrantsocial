import { getConversations } from "@/app/chat/actions";
import { NextResponse } from "next/server";

export async function GET() {
  const conversations = await getConversations();
  return NextResponse.json(conversations);
}
