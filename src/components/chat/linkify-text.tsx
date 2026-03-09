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

export function LinkifyText({ text }: { text: string }) {
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
      parts.push(
        <a
          key={match.index}
          href={`/${match[5]}`}
          className="font-medium hover:underline"
        >
          {matched}
        </a>
      );
    } else if (match[4]) {
      // Hashtag match (group 4) - #tag
      parts.push(
        <a
          key={match.index}
          href={`/tag/${normalizeTag(match[4])}`}
          className="font-medium hover:underline"
        >
          {matched}
        </a>
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

    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
