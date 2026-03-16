"use server";

import fs from "fs";
import path from "path";

const WAITLIST_PATH = path.join(process.cwd(), "premium-waitlist.txt");

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function subscribeToPremiumNotify(
  email: string
): Promise<{ success: boolean; message: string }> {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed || !isValidEmail(trimmed)) {
    return { success: false, message: "Please enter a valid email address." };
  }

  try {
    // Read existing emails to deduplicate
    let existing = new Set<string>();
    if (fs.existsSync(WAITLIST_PATH)) {
      const content = fs.readFileSync(WAITLIST_PATH, "utf-8");
      existing = new Set(
        content.split("\n").map((l) => l.trim().toLowerCase()).filter(Boolean)
      );
    }

    if (existing.has(trimmed)) {
      return { success: true, message: "You're already on the list! We'll email you when premium launches." };
    }

    fs.appendFileSync(WAITLIST_PATH, trimmed + "\n", "utf-8");
    return { success: true, message: "You're on the list! We'll send you one email when premium launches." };
  } catch {
    return { success: false, message: "Something went wrong. Please try again." };
  }
}
