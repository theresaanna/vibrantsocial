import { normalizeTag } from "@/lib/tags";

const URL_REGEX =
  /(https?:\/\/(?:www\.)?[-\w@:%.+~#=]{1,256}\.[a-zA-Z]{2,}(?:[-\w()@:%+.~#?&/=]*))/;
const WWW_REGEX =
  /(www\.[-\w@:%.+~#=]{1,256}\.[a-zA-Z]{2,}(?:[-\w()@:%+.~#?&/=]*))/;
const EMAIL_REGEX =
  /((?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))/;

const HASHTAG_REGEX = /(?<![a-zA-Z0-9])#([a-zA-Z0-9][a-zA-Z0-9-]{0,49})/;
const MENTION_REGEX = /(?<![a-zA-Z0-9])@([a-zA-Z0-9_]{3,30})/;

const COMBINED_REGEX = new RegExp(
  `${URL_REGEX.source}|${WWW_REGEX.source}|${EMAIL_REGEX.source}|${HASHTAG_REGEX.source}|${MENTION_REGEX.source}`,
  "g"
);

/**
 * @param text - The plain text to parse
 * @param asSpans - When true, renders mentions/hashtags/links as styled
 *   <span> elements instead of <a> tags.  Use this when LinkifyText is
 *   rendered inside an interactive parent (<a>, <button>, <Link>) to
 *   avoid invalid nested interactive HTML.
 */
export function LinkifyText({
  text,
  asSpans = false,
}: {
  text: string;
  asSpans?: boolean;
}) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  COMBINED_REGEX.lastIndex = 0;
  while ((match = COMBINED_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];

    if (match[5]) {
      // Mention match (group 5) - @username
      const Tag = asSpans ? "span" : "a";
      parts.push(
        <Tag
          key={match.index}
          {...(!asSpans ? { href: `/${match[5]}` } : {})}
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {matched}
        </Tag>
      );
    } else if (match[4]) {
      // Hashtag match (group 4) - #tag
      const Tag = asSpans ? "span" : "a";
      parts.push(
        <Tag
          key={match.index}
          {...(!asSpans ? { href: `/tag/${normalizeTag(match[4])}` } : {})}
          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {matched}
        </Tag>
      );
    } else {
      // URL, www, or email match
      let href: string;
      if (match[3]) {
        href = `mailto:${matched}`;
      } else if (match[2]) {
        href = `https://${matched}`;
      } else {
        href = matched;
      }

      if (asSpans) {
        parts.push(
          <span key={match.index} className="underline break-all">
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
