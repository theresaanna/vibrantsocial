import type { UserThemeResult } from "@/lib/user-theme";
import { ProfileSparklefall } from "@/components/profile-sparklefall";

interface ThemedPageProps extends UserThemeResult {
  children: React.ReactNode;
  className?: string;
  /** When true, skip the <main> wrapper and render children directly */
  bare?: boolean;
}

export function ThemedPage({
  hasCustomTheme,
  themeStyle,
  bgImageStyle,
  sparklefallProps,
  children,
  className = "mx-auto max-w-3xl px-4 py-6",
  bare = false,
}: ThemedPageProps) {
  return (
    <div
      className={hasCustomTheme ? "profile-themed" : ""}
      style={{ ...themeStyle, ...bgImageStyle }}
    >
      {sparklefallProps && <ProfileSparklefall {...sparklefallProps} />}
      {bare ? children : <main className={className}>{children}</main>}
    </div>
  );
}
