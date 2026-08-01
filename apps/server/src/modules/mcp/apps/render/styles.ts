import { readFileSync } from 'node:fs';
import path from 'node:path';

import { require } from '../shared';

/** The SDK stylesheet, split in two.
 *
 *  Everything the page shell inlines is paid for by EVERY widget: the host loads the ui:// page into a fresh
 *  sandboxed iframe and parses it whole before anything paints, which is the "Rendering…" the user waits through.
 *  Three of those @font-face blocks are Font Awesome shipped as base64 woff2 — ~330 KB, close to a fifth of the
 *  page — and only a widget that authored a `fontAwesome` element has any use for them.
 *
 *  So the shell takes the base, and the fonts travel in the tool result of the renders that actually draw an icon
 *  (see tools/render.ts). A widget without icons never downloads a glyph; one with icons looks exactly the same as
 *  before. */

/** Where the closing brace of the block opened at `open` is, so a nested one cannot end it early. Returns the
 *  string's length when the CSS is truncated mid-block, which drops that tail rather than mixing it into the base. */
const blockEnd = (css: string, open: number): number => {
  let depth = 0;
  for (let at = open; at < css.length; at++) {
    if (css[at] === '{') {
      depth++;
    } else if (css[at] === '}') {
      depth--;
      if (depth === 0) {
        return at + 1;
      }
    }
  }

  return css.length;
};

/** Lifts every @font-face block out of a stylesheet. Brace counting rather than a CSS parser: a @font-face body is
 *  plain declarations, and base64 payloads and url() values carry no braces of their own. */
export const splitFontFaces = (css: string): { base: string; fonts: string } => {
  const base: string[] = [];
  const fonts: string[] = [];
  let cursor = 0;

  for (let at = css.indexOf('@font-face', cursor); at !== -1; at = css.indexOf('@font-face', cursor)) {
    const open = css.indexOf('{', at);
    if (open === -1) {
      break;
    }

    const end = blockEnd(css, open);
    base.push(css.slice(cursor, at));
    fonts.push(css.slice(at, end));
    cursor = end;
  }

  base.push(css.slice(cursor));

  return { base: base.join(''), fonts: fonts.join('') };
};

const stylesheet = (): string =>
  readFileSync(path.join(path.dirname(require.resolve('@plitzi/plitzi-sdk')), 'plitzi-sdk.css'), 'utf-8');

// Read and split once per process: the file is half a megabyte and every render asks for one half or the other.
let split: { base: string; fonts: string } | undefined;

const sdkStyles = (): { base: string; fonts: string } => (split ??= splitFontFaces(stylesheet()));

/** What the page shell inlines: the SDK stylesheet without the icon fonts. */
export const widgetCss = (): string => sdkStyles().base;

/** The icon fonts, for the renders that draw one. */
export const iconFontCss = (): string => sdkStyles().fonts;
