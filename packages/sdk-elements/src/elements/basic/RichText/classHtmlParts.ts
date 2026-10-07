import clsx from 'clsx';

import type { MarkdownClassNames, MarkdownPart } from '@plitzi/plitzi-ui/Markdown';

/**
 * The part each tag of a body's HTML is, named as the parts of a Markdown document are, so one set of slots dresses
 * a body whichever format the CMS returns it in. `b` and `i` are the `strong` and `emphasis` an older editor writes.
 */
export const HTML_TAG_PARTS: Readonly<Partial<Record<string, readonly MarkdownPart[]>>> = {
  h1: ['heading', 'heading1'],
  h2: ['heading', 'heading2'],
  h3: ['heading', 'heading3'],
  h4: ['heading', 'heading4'],
  h5: ['heading', 'heading5'],
  h6: ['heading', 'heading6'],
  p: ['paragraph'],
  a: ['link'],
  strong: ['strong'],
  b: ['strong'],
  em: ['emphasis'],
  i: ['emphasis'],
  ul: ['list'],
  ol: ['list'],
  li: ['listItem'],
  blockquote: ['quote'],
  hr: ['divider'],
  code: ['code'],
  pre: ['codeBlock'],
  img: ['image'],
  table: ['table'],
  thead: ['tableHead'],
  tr: ['tableRow'],
  th: ['tableHeaderCell'],
  td: ['tableCell']
};

/** A tag, opening or closing, with its attributes — a `>` inside a quoted value does not end it. */
const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;

const CLASS_ATTRIBUTE = /\sclass\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/i;

const QUOTES = /^["']|["']$/g;

const SELF_CLOSING = /\s*\/$/;

/** The tag's attributes with `className` added to the class it already has, or as its class. */
const withClass = (attributes: string, className: string): string => {
  const existing = CLASS_ATTRIBUTE.exec(attributes);
  if (existing) {
    const current = existing[1].replace(QUOTES, '');

    return attributes.replace(CLASS_ATTRIBUTE, ` class="${clsx(current, className)}"`);
  }

  const closing = SELF_CLOSING.exec(attributes)?.[0] ?? '';

  return `${attributes.slice(0, attributes.length - closing.length)} class="${className}"${closing}`;
};

/**
 * A body's HTML with the class of each of its parts on the tags that are that part.
 *
 * Read off the markup as a string, as the sanitizer reads it, so the server renders the same classes the browser does.
 * `code` is inline code, as in a Markdown document: the `code` of a `pre` is the block's, and the `pre` takes
 * `codeBlock`.
 */
export const classHtmlParts = (html: string, classNames: MarkdownClassNames): string => {
  if (!Object.values(classNames).some(Boolean)) {
    return html;
  }

  let preDepth = 0;

  return html.replace(TAG, (tag, slash: string, name: string, attributes: string) => {
    const tagName = name.toLowerCase();
    if (tagName === 'pre') {
      preDepth = Math.max(preDepth + (slash ? -1 : 1), 0);
    }

    if (slash || (tagName === 'code' && preDepth > 0)) {
      return tag;
    }

    const className = clsx((HTML_TAG_PARTS[tagName] ?? []).map(part => classNames[part]));

    return className ? `<${name}${withClass(attributes, className)}>` : tag;
  });
};
