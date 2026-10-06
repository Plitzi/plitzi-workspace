import { uniqueAnchor } from './anchor';

export type MarkdownHeading = { level: number; text: string; anchor: string };

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;

/** A heading's words as a reader sees them: the inline Markdown around them taken away, as the renderer takes it. */
export const headingText = (source: string): string =>
  source
    // A picture renders no words, and raw HTML is not rendered at all.
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`+([^`]*?)`+/g, '$1')
    .replace(/(\*\*|~~)(.+?)\1/g, '$2')
    .replace(/\*(.+?)\*/g, '$1')
    // Underscores emphasise only at a word's edge: `snake_case` is a word, not an emphasis.
    .replace(/\b__(.+?)__\b/g, '$1')
    .replace(/\b_(.+?)_\b/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!|~>])/g, '$1')
    .trim();

/**
 * Every heading of a Markdown document, in order, with the anchor its `id` is when it renders — what a table of
 * contents links to, and what a link's `hash` may name. ATX headings (`## Title`), outside fenced code; every level
 * shares one set of anchors, as the rendered page does.
 */
export const markdownHeadings = (source: string): MarkdownHeading[] => {
  const taken = new Set<string>();
  const headings: MarkdownHeading[] = [];
  let fence: string | undefined;
  for (const line of source.split('\n')) {
    const opening = FENCE.exec(line)?.[1];
    if (opening) {
      if (!fence) {
        fence = opening;
      } else if (opening[0] === fence[0] && opening.length >= fence.length) {
        fence = undefined;
      }

      continue;
    }

    const match = fence ? null : ATX.exec(line);
    if (match) {
      const text = headingText(match[2]);
      headings.push({ level: match[1].length, text, anchor: uniqueAnchor(text, taken) });
    }
  }

  return headings;
};
