"use client";

import {
  AutoLinkPlugin as LexicalAutoLinkPlugin,
  createLinkMatcherWithRegExp,
} from "@lexical/react/LexicalAutoLinkPlugin";

export const URL_REGEX =
  /(https?:\/\/(?:www\.)?[-\w@:%.+~#=]{1,256}\.[a-zA-Z]{2,}(?:[-\w()@:%+.~#?&/=]*))/;

export const WWW_REGEX =
  /(www\.[-\w@:%.+~#=]{1,256}\.[a-zA-Z]{2,}(?:[-\w()@:%+.~#?&/=]*))/;

export const EMAIL_REGEX =
  /((?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))/;

export const MATCHERS = [
  createLinkMatcherWithRegExp(URL_REGEX, (text) => text),
  createLinkMatcherWithRegExp(WWW_REGEX, (text) => `https://${text}`),
  createLinkMatcherWithRegExp(EMAIL_REGEX, (text) => `mailto:${text}`),
];

export function AutoLinkPlugin() {
  return <LexicalAutoLinkPlugin matchers={MATCHERS} />;
}
