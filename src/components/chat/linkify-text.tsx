import { normalizeTag } from "@/lib/tags";

const URL_REGEX =
  /(https?:\/\/(?:www\.)?[-\w@:%.+~#=]{1,256}\.[a-zA-Z]{2,}(?:[-\w()@:%+.~#?&/=]*))/;
const WWW_REGEX =
  /(www\.[-\w@:%.+~#=]{1,256}\.[a-zA-Z]{2,}(?:[-\w()@:%+.~#?&/=]*))/;
const EMAIL_REGEX =
  /((?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))/;

const COMMON_TLDS =
  "com|org|net|io|co|dev|app|me|info|biz|us|uk|ca|au|de|fr|es|it|nl|ru|br|in|jp|edu|gov|mil|tv|cc|gg|xyz|ai|so|to|fm|ly|sh|gl|vc|la|ws|sx|lol";
const BARE_DOMAIN_REGEX = new RegExp(
  `((?:[-\\w]+\\.)+(?:${COMMON_TLDS})(?:\\.\\w{2,3})?(?:[-\\w()@:%+.~#?&/=]*))`
);

const HASHTAG_REGEX = /(?<![a-zA-Z0-9])#([a-zA-Z0-9][a-zA-Z0-9-]{0,49})/;
const MENTION_REGEX = /(?<![a-zA-Z0-9])@([a-zA-Z0-9_]{3,30})/;

// Group indices: 1=URL, 2=WWW, 3=EMAIL, 4=BARE_DOMAIN, 5=HASHTAG, 6=MENTION
const COMBINED_REGEX = new RegExp(
  `${URL_REGEX.source}|${WWW_REGEX.source}|${EMAIL_REGEX.source}|${BARE_DOMAIN_REGEX.source}|${HASHTAG_REGEX.source}|${MENTION_REGEX.source}`,
  "g"
);

const DEFAULT_LINK_CLASS = "font-medium text-blue-600 dark:text-blue-400 hover:underline";
const THEMED_LINK_STYLE: React.CSSProperties = { color: "var(--chat-link-color)" };

const IMAGE_URL_RE = /\.(?:jpe?g|png|gif|webp|svg|heic|heif|avif|bmp|ico)(?:\?[^\s]*)?$/i;

/** True when the URL path ends with a common image extension. */
export function isImageUrl(url: string): boolean {
  try {
    return IMAGE_URL_RE.test(new URL(url).pathname);
  } catch {
    return IMAGE_URL_RE.test(url);
  }
}

/**
 * Extract the first http/https URL from plain text.
 * Skips email addresses (e.g., user@example.com).
 */
export function extractFirstUrlFromText(text: string): string | null {
  const URL_ONLY_REGEX = new RegExp(
    `${URL_REGEX.source}|${WWW_REGEX.source}|${BARE_DOMAIN_REGEX.source}`,
    "g"
  );
  let match: RegExpExecArray | null;
  while ((match = URL_ONLY_REGEX.exec(text)) !== null) {
    if (!match[1] && !match[2] && match.index > 0 && text[match.index - 1] === "@") {
      continue;
    }
    const matched = match[0];
    if (match[1]) return matched;
    return `https://${matched}`;
  }
  return null;
}

/**
 * @param text - The plain text to parse
 * @param asSpans - When true, renders mentions/hashtags/links as styled
 *   <span> elements instead of <a> tags.  Use this when LinkifyText is
 *   rendered inside an interactive parent (<a>, <button>, <Link>) to
 *   avoid invalid nested interactive HTML.
 * @param themed - When true, uses the chat theme link color CSS variable
 *   instead of the default blue.
 */
export function LinkifyText({
  text,
  asSpans = false,
  themed = false,
}: {
  text: string;
  asSpans?: boolean;
  themed?: boolean;
}) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const linkClass = themed ? "font-medium hover:underline" : DEFAULT_LINK_CLASS;
  const linkStyle = themed ? THEMED_LINK_STYLE : undefined;

  COMBINED_REGEX.lastIndex = 0;
  while ((match = COMBINED_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];

    if (match[6]) {
      // Mention match (group 6) - @username
      const Tag = asSpans ? "span" : "a";
      parts.push(
        <Tag
          key={match.index}
          {...(!asSpans ? { href: `/${match[6]}` } : {})}
          className={linkClass}
          style={linkStyle}
        >
          {matched}
        </Tag>
      );
    } else if (match[5]) {
      // Hashtag match (group 5) - #tag
      const Tag = asSpans ? "span" : "a";
      parts.push(
        <Tag
          key={match.index}
          {...(!asSpans ? { href: `/tag/${normalizeTag(match[5])}` } : {})}
          className={linkClass}
          style={linkStyle}
        >
          {matched}
        </Tag>
      );
    } else {
      // URL, www, email, or bare domain match
      let href: string;
      if (match[3]) {
        href = `mailto:${matched}`;
      } else if (match[2] || match[4]) {
        // www. prefix or bare domain — prepend https://
        href = `https://${matched}`;
      } else {
        href = matched;
      }

      if (asSpans) {
        parts.push(
          <span key={match.index} className="underline break-all" style={linkStyle}>
            {matched}
          </span>
        );
      } else {
        parts.push(
          <a
            key={match.index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline break-all"
            style={linkStyle}
          >
            {matched}
          </a>
        );
      }
    }

    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
