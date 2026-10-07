/**
 * The parts of the HTML a Markdown source is written as, each of which can carry a class of the consumer's own.
 *
 * - `heading` is every heading, `h1`–`h6`; `heading1`…`heading6` is the one of that level, beside it.
 * - `paragraph` (`p`), `link` (`a`), `strong` (`strong`), `emphasis` (`em`), `list` (`ul`/`ol`), `listItem` (`li`),
 *   `quote` (`blockquote`), `divider` (`hr`), `image` (`img`).
 * - `code` is inline `code`; `codeBlock` the `pre` of a fenced block, inside its frame (`div.markdown-code`,
 *   `codeBlockFrame`) under a header (`div.markdown-code-header`, `codeBlockHeader`) that holds its language
 *   (`span.markdown-code-language`, `codeBlockLanguage`) and its copy button (`button.markdown-code-copy`,
 *   `codeBlockCopy`).
 * - `table`, `tableHead` (`thead`), `tableRow` (`tr`), `tableHeaderCell` (`th`), `tableCell` (`td`).
 * - `anchor` is the link a heading offers to itself.
 */
export const MARKDOWN_PARTS = [
  'heading',
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  'heading5',
  'heading6',
  'paragraph',
  'link',
  'strong',
  'emphasis',
  'list',
  'listItem',
  'quote',
  'divider',
  'code',
  'codeBlock',
  'codeBlockFrame',
  'codeBlockHeader',
  'codeBlockLanguage',
  'codeBlockCopy',
  'image',
  'table',
  'tableHead',
  'tableRow',
  'tableHeaderCell',
  'tableCell',
  'anchor'
] as const;

export type MarkdownPart = (typeof MARKDOWN_PARTS)[number];

export type MarkdownClassNames = Partial<Record<MarkdownPart, string>>;
