import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import ts from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';

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

/** The highlighter a fenced block is drawn with, its languages registered once — the light build carries no others. */
export { SyntaxHighlighter };
