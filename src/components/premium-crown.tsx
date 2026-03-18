import Link from "next/link";

interface PremiumCrownProps {
  className?: string;
  color?: "amber" | "green";
  href?: string;
}

const colorStyles = {
  amber: { bg: "bg-amber-400", icon: "text-amber-900" },
  green: { bg: "bg-emerald-500", icon: "text-white" },
};

export function PremiumCrown({ className = "", color = "amber", href }: PremiumCrownProps) {
  const { bg, icon } = colorStyles[color];

  const crown = (
    <span
      className={`absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full ${bg} shadow-sm ${className}`}
      title="Premium member"
    >
      <svg
        className={`h-2.5 w-2.5 ${icon}`}
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M2 19h20v3H2v-3zm1-1L12 4l4.5 7L22 5v13H2V18z" />
      </svg>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="relative">
        {crown}
      </Link>
    );
  }

  return crown;
}
