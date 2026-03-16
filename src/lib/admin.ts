export function isAdmin(userId: string | undefined): boolean {
  if (!userId) return false;
  const ids = process.env.ADMIN_USER_IDS ?? "";
  return ids
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
