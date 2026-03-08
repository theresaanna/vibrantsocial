import {
  URL_REGEX,
  WWW_REGEX,
  EMAIL_REGEX,
} from "@/components/editor/plugins/AutoLinkPlugin";

const COMBINED_REGEX = new RegExp(
  `${URL_REGEX.source}|${WWW_REGEX.source}|${EMAIL_REGEX.source}`,
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
    let href: string;
    if (match[3]) {
      // Email match (group 3)
      href = `mailto:${matched}`;
    } else if (match[2]) {
      // www match (group 2)
      href = `https://${matched}`;
    } else {
      // Full URL match (group 1)
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

    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
