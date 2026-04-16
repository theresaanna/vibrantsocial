import Link from "next/link";

interface TagData {
  name: string;
  count: number;
}

interface TagCloudProps {
  tags: TagData[];
}

const PILL_COLORS = [
  "bg-purple-500 hover:bg-purple-600",
  "bg-red-500 hover:bg-red-600",
  "bg-yellow-500 hover:bg-yellow-600",
  "bg-fuchsia-500 hover:bg-fuchsia-600",
  "bg-blue-500 hover:bg-blue-600",
  "bg-green-500 hover:bg-green-600",
  "bg-orange-500 hover:bg-orange-600",
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

        return (
          <Link
            key={tag.name}
            href={`/tag/${tag.name}`}
            className={`tag-pill inline-flex items-center gap-1 sm:gap-1.5 rounded-full font-semibold transition-colors ${PILL_COLORS[i % PILL_COLORS.length]}`}
            style={{
              "--pill-fs": `${fontSize}px`,
              "--pill-px": `${px}px`,
              "--pill-py": `${py}px`,
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
