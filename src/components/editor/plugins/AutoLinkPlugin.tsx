"use client";

import {
  AutoLinkPlugin as LexicalAutoLinkPlugin,
  createLinkMatcherWithRegExp,
} from "@lexical/react/LexicalAutoLinkPlugin";

export const URL_REGEX =
  /(https?:\/\/(?:www\.)?[-\w@:%.+~#=]{1,256}\.[a-zA-Z]{2,}(?:[-\w()@:%+.~#?&/=]*))/;

export const WWW_REGEX =
  /(www\.[-\w@:%.+~#=]{1,256}\.[a-zA-Z]{2,}(?:[-\w()@:%+.~#?&/=]*))/;

/**
 * Matches bare domains like "example.com" or "docs.google.com/path?q=1".
 * Uses a list of common TLDs to avoid false positives on normal words with dots.
 */
const COMMON_TLDS =
  "com|org|net|io|co|dev|app|me|info|biz|us|uk|ca|au|de|fr|es|it|nl|ru|br|in|jp|edu|gov|mil|tv|cc|gg|xyz|ai|so|to|fm|ly|sh|gl|vc|la|ws|sx|lol";
export const BARE_DOMAIN_REGEX = new RegExp(
  `((?:[-\\w]+\\.)+(?:${COMMON_TLDS})(?:\\.\\w{2,3})?(?:[-\\w()@:%+.~#?&/=]*))`
);

export const EMAIL_REGEX =
  /((?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))/;

export const MATCHERS = [
  createLinkMatcherWithRegExp(URL_REGEX, (text) => text),
  createLinkMatcherWithRegExp(WWW_REGEX, (text) => `https://${text}`),
  // Email must come before bare domain so "user@example.com" becomes mailto:, not a link
  createLinkMatcherWithRegExp(EMAIL_REGEX, (text) => `mailto:${text}`),
  createLinkMatcherWithRegExp(BARE_DOMAIN_REGEX, (text) => `https://${text}`),
];

export function AutoLinkPlugin() {
  return <LexicalAutoLinkPlugin matchers={MATCHERS} />;
}
