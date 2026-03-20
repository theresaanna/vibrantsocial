import Link from "next/link";

interface PremiumBadgeProps {
  className?: string;
  color?: "amber" | "green";
  href?: string;
  inline?: boolean;
}

const colorStyles = {
  amber: { bg: "bg-amber-400", icon: "text-amber-900" },
  green: { bg: "bg-emerald-500", icon: "text-white" },
};

export function PremiumBadge({ className = "", color = "green", href, inline = false }: PremiumBadgeProps) {
  const { bg, icon } = colorStyles[color];

  const positionClass = inline
    ? "relative inline-flex"
    : "absolute -right-1.5 -top-1.5 flex";

  const badge = (
    <span
      className={`${positionClass} h-4 w-4 items-center justify-center rounded-full ${bg} shadow-sm ${className}`}
      title="Premium feature"
    >
      <svg
        className={`h-2.5 w-2.5 ${icon}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="relative">
        {badge}
      </Link>
    );
  }

  return badge;
}

// Backward-compatible alias
export const PremiumCrown = PremiumBadge;
