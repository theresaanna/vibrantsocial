import Link from "next/link";

interface TagData {
  name: string;
  count: number;
}

interface TagCloudProps {
  tags: TagData[];
}

/**
 * Opacity percentages mixed with the theme link color to create
 * varied-but-cohesive pill backgrounds from the user's palette.
 */
const PILL_MIX = [
  { link: 100, secondary: 0 },
  { link: 80, secondary: 20 },
  { link: 60, secondary: 40 },
  { link: 90, secondary: 10 },
  { link: 70, secondary: 30 },
  { link: 50, secondary: 50 },
  { link: 85, secondary: 15 },
];

export function TagCloud({ tags }: TagCloudProps) {
  const maxCount = Math.max(...tags.map((t) => t.count), 1);
  const minCount = Math.min(...tags.map((t) => t.count), 1);
  const range = maxCount - minCount || 1;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3" data-testid="tag-cloud">
      {tags.map((tag, i) => {
        const t = (tag.count - minCount) / range;
        const fontSize = 14 + t * 16;
        const px = 16 + t * 16;
        const py = 8 + t * 8;
        const mix = PILL_MIX[i % PILL_MIX.length];

        return (
          <Link
            key={tag.name}
            href={`/tag/${tag.name}`}
            className="tag-pill inline-flex items-center gap-1 sm:gap-1.5 rounded-full font-semibold transition-colors hover:brightness-90"
            style={{
              "--pill-fs": `${fontSize}px`,
              "--pill-px": `${px}px`,
              "--pill-py": `${py}px`,
              backgroundColor: `color-mix(in srgb, var(--profile-link, #2563eb) ${mix.link}%, var(--profile-secondary, #71717a))`,
            } as React.CSSProperties}
          >
            #{tag.name}
            <span className="opacity-70">{tag.count}</span>
          </Link>
        );
      })}
    </div>
  );
}
