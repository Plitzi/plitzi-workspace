import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';

import { keptByText } from '../../../Element/helpers/keptByText';

import type { ReactElement } from 'react';
import type { SyntaxHighlighterProps } from 'react-syntax-highlighter';

// A grammar imported from CommonJS arrives as its module object on some bundlers, with the grammar under `default`.
const grammarOf = (module: unknown): unknown =>
  typeof module === 'object' && module !== null && 'default' in module ? module.default : module;

const LANGUAGES: Record<string, unknown> = {
  javascript: js,
  typescript: ts,
  jsx,
  tsx,
  bash,
  json,
  css,
  html: markup,
  markdown: markup
};

for (const [name, grammar] of Object.entries(LANGUAGES)) {
  SyntaxHighlighter.registerLanguage(name, grammarOf(grammar));
}

/**
 * The light build as what it is: a function of its props to the highlighted tree, with no hooks
 * (`dist/esm/highlight.js`, held to it by the test beside this). Its types declare a class, which it is not.
 */
const highlight = SyntaxHighlighter as unknown as (props: SyntaxHighlighterProps) => ReactElement;

/** Highlighted blocks kept by their text and how they are drawn: a block is highlighted the same on every render. */
const highlighted = keptByText<ReactElement>(256 * 1024);

export type HighlightedCodeOptions = { code: string; language: string; wrapLines: boolean; showLineNumbers: boolean };

/** A fenced block's text highlighted in its language — tokenized and made into elements once, then kept. */
export const highlightedCode = ({
  code,
  language,
  wrapLines,
  showLineNumbers
}: HighlightedCodeOptions): ReactElement => {
  const key = `${language}\u0000${String(wrapLines)}\u0000${String(showLineNumbers)}\u0000${code}`;
  const known = highlighted.get(key);
  if (known) {
    return known;
  }

  const made = highlight({ PreTag: 'div', language, style: vscDarkPlus, wrapLines, showLineNumbers, children: code });
  highlighted.set(key, made);

  return made;
};

export { SyntaxHighlighter };
