import Link from "next/link";

interface TagData {
  name: string;
  count: number;
}

interface TagCloudProps {
  tags: TagData[];
}

/**
 * Generates a set of background colors derived from the user's theme.
 * Uses --profile-text as the base hue and creates variations via opacity mixing.
 * Falls back to a set of subtle zinc tones when no theme is active.
 */
const OPACITY_STEPS = [0.12, 0.16, 0.20, 0.24, 0.28, 0.10, 0.18];

export function TagCloud({ tags }: TagCloudProps) {
  const maxCount = Math.max(...tags.map((t) => t.count), 1);
  const minCount = Math.min(...tags.map((t) => t.count), 1);
  const range = maxCount - minCount || 1;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2" data-testid="tag-cloud">
      {tags.map((tag, i) => {
        // Scale: smaller range than before — compact bubbles
        const t = (tag.count - minCount) / range;
        const fontSize = 11 + t * 5; // 11px – 16px
        const opacity = OPACITY_STEPS[i % OPACITY_STEPS.length];

        return (
          <Link
            key={tag.name}
            href={`/tag/${tag.name}`}
            className="tag-bubble inline-flex items-center gap-1 rounded-full font-medium transition-all hover:scale-105 hover:shadow-sm"
            style={{
              fontSize: `${fontSize}px`,
              padding: `${4 + t * 2}px ${8 + t * 4}px`,
              backgroundColor: `color-mix(in srgb, var(--profile-link, #6366f1) ${Math.round(opacity * 100)}%, transparent)`,
              color: "var(--profile-text, #18181b)",
            }}
          >
            <span>#{tag.name}</span>
            <span
              className="tabular-nums"
              style={{
                opacity: 0.5,
                fontSize: `${Math.max(fontSize - 2, 10)}px`,
              }}
            >
              {tag.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
