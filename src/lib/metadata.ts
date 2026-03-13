import type { Metadata } from "next";

export const SITE_NAME = "VibrantSocial";
export const SITE_DESCRIPTION =
  "Social media for adults. No algorithms, no AI nonsense — just self expression.";

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://vibrantsocial.app"
  );
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + "\u2026";
}

export function buildMetadata({
  title,
  description,
  path,
  images,
  noIndex,
}: {
  title: string;
  description: string;
  path?: string;
  images?: { url: string; alt?: string }[];
  noIndex?: boolean;
}): Metadata {
  const baseUrl = getBaseUrl();
  const url = path ? `${baseUrl}${path}` : undefined;

  return {
    title,
    description,
    ...(noIndex && { robots: { index: false, follow: false } }),
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      ...(url && { url }),
      ...(images && { images }),
    },
    twitter: {
      card: images?.length ? "summary_large_image" : "summary",
      title,
      description,
      ...(images && { images: images.map((i) => i.url) }),
    },
    ...(url && { alternates: { canonical: url } }),
  };
}
