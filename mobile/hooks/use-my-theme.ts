/**
 * Hook to fetch and cache the current user's theme data.
 * Used to apply the user's own theme to pages like the feed.
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { UserThemeData } from "@/lib/user-theme";

export function useMyTheme() {
  const { user } = useAuth();

  return useQuery<Partial<UserThemeData> | null>({
    queryKey: ["myTheme", user?.id],
    queryFn: () => api.rpc<Partial<UserThemeData> | null>("getUserTheme"),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
}
