/**
 * What an element's `anchor` may be: the `id` it carries in the DOM, so `/page#anchor` lands on it.
 *
 * Lowercase, starting with a letter, then letters, digits and hyphens — a fragment a person types in a URL, with no
 * escaping and no case to get wrong. The one rule the authoring package, the builder and the MCP all hold it to.
 */
export const ANCHOR_PATTERN = /^[a-z][a-z0-9-]*$/;

export const isAnchor = (value: unknown): value is string => typeof value === 'string' && ANCHOR_PATTERN.test(value);

/**
 * The anchor a piece of text reads as: its words, accents dropped and lowercased, a hyphen for every run of anything
 * else, and nothing before the first letter — `Server-resolved data` is `server-resolved-data`. What a Markdown
 * heading's `id` is, and what authoring offers an element that needs an anchor.
 */
export const anchorOf = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+|-+$/g, '') || 'section';

/**
 * The anchor `text` takes on a page that already carries `taken` — `faq`, then `faq-2`, `faq-3` — recorded in `taken`,
 * so the next heading of the same words gets the next one. A page renders its headings in order, and so numbers them.
 */
export const uniqueAnchor = (text: string, taken: Set<string>): string => {
  const base = anchorOf(text);
  let anchor = base;
  for (let next = 2; taken.has(anchor); next += 1) {
    anchor = `${base}-${String(next)}`;
  }

  taken.add(anchor);

  return anchor;
};
