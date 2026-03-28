import Link from "next/link";
import { FramedAvatar } from "@/components/framed-avatar";
import { extractTextFromLexicalJson } from "@/lib/lexical-text";
import { StyledName } from "@/components/styled-name";
import { LinkifyText } from "@/components/chat/linkify-text";

interface MarketplaceData {
  id: string;
  price: number;
  purchaseUrl: string;
  shippingOption: string;
  shippingPrice: number | null;
}

interface SearchPostCardProps {
  post: {
    id: string;
    slug?: string | null;
    content: string;
    createdAt: string;
    author: {
      id: string;
      username: string | null;
      displayName: string | null;
      name: string | null;
      avatar: string | null;
      image: string | null;
      profileFrameId: string | null;
      usernameFont?: string | null;
    };
    _count: {
      likes: number;
      comments: number;
      reposts: number;
    };
    tags?: Array<{ tag: { name: string } }>;
    marketplacePost?: MarketplaceData | null;
  };
}

function formatShipping(option: string, price: number | null): string {
  if (option === "FREE") return "Free shipping";
  if (option === "FLAT_RATE" && price != null)
    return `+${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(price)} shipping`;
  if (option === "PICKUP_ONLY") return "Pickup only";
  return "Contact seller for shipping";
}

export function SearchPostCard({ post }: SearchPostCardProps) {
  const avatarSrc = post.author.avatar || post.author.image;
  const displayName =
    post.author.displayName ||
    post.author.name ||
    post.author.username ||
    "User";
  const timeAgo = formatTimeAgo(post.createdAt);
  const plainText = extractTextFromLexicalJson(post.content);
  const isMarketplace = !!post.marketplacePost;

  const href = post.slug && post.author.username
    ? `/${post.author.username}/${isMarketplace ? "marketplace" : "post"}/${post.slug}`
    : `/${isMarketplace ? "marketplace" : "post"}/${post.id}`;

  return (
    <Link
      href={href}
      className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <div className="flex items-center gap-2">
        <FramedAvatar src={avatarSrc} alt={displayName} initial={displayName[0]?.toUpperCase()} size={40} frameId={post.author.profileFrameId} />
        <div className="flex items-baseline gap-1.5 text-sm">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            <StyledName fontId={post.author.usernameFont}>{displayName}</StyledName>
          </span>
          {post.author.username && (
            <span className="text-zinc-500">@{post.author.username}</span>
          )}
          <span className="text-zinc-400">&middot;</span>
          <span className="text-zinc-400">{timeAgo}</span>
        </div>
      </div>

      <p className="mt-2 line-clamp-3 text-sm text-zinc-700 dark:text-zinc-300">
        <LinkifyText text={plainText || "No content"} asSpans />
      </p>

      {post.marketplacePost && (
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-pink-500 px-2 py-0.5 text-xs font-bold text-white">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(post.marketplacePost.price)}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatShipping(post.marketplacePost.shippingOption, post.marketplacePost.shippingPrice)}
          </span>
        </div>
      )}

      {post.tags && post.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.tags.map((pt) => (
            <span
              key={pt.tag.name}
              className="inline-block rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-600 dark:bg-fuchsia-950/30 dark:text-fuchsia-400"
            >
              #{pt.tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-4 text-xs text-zinc-400">
        <span>
          {post._count.likes} {post._count.likes === 1 ? "like" : "likes"}
        </span>
        <span>
          {post._count.comments}{" "}
          {post._count.comments === 1 ? "comment" : "comments"}
        </span>
        <span>
          {post._count.reposts}{" "}
          {post._count.reposts === 1 ? "repost" : "reposts"}
        </span>
      </div>
    </Link>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 30) return `${diffDay}d`;
  return date.toLocaleDateString();
}
