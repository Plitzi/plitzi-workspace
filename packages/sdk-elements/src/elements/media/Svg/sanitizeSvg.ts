import { sanitizeHtml } from '../../basic/RichText/sanitizeHtml';

/** HTML inside an SVG, which brings everything HTML can do with it. Dropped with its contents. */
const FOREIGN_OBJECT = /<\s*foreignObject\b[\s\S]*?<\s*\/\s*foreignObject\s*>|<\s*\/?\s*foreignObject\b[^>]*>/gi;

/** `<set>` and `<animate>` can write a `javascript:` URL into an `href` after the markup was checked. */
const SCRIPTED_ANIMATION = /\s(to|from|values|by)\s*=\s*(?:"[^"]*javascript\s*:[^"]*"|'[^']*javascript\s*:[^']*')/gi;

/** One `<svg>…</svg>` and nothing around it but whitespace and comments. */
const ONE_SVG = /^\s*(?:<!--[\s\S]*?-->\s*)*<svg\b[\s\S]*<\/svg>\s*$/i;

/** Whether the markup is an SVG at all — what the element refuses to draw otherwise. */
export const isSvgMarkup = (markup: string): boolean => ONE_SVG.test(markup);

/**
 * The SVG with everything that runs taken out: what `sanitizeHtml` takes out of rich text — scripts, handlers,
 * `javascript:` and `data:` URLs — and what only SVG has, HTML inside a `foreignObject` and animations that write a
 * script into a link. An SVG is drawing; nothing in one needs to run.
 */
export const sanitizeSvg = (markup: string): string =>
  sanitizeHtml(markup).replace(FOREIGN_OBJECT, '').replace(SCRIPTED_ANIMATION, '');

/** The opening `<svg …>` tag — the root, the first one there is. */
const ROOT_TAG = /<svg\b[^>]*>/i;

/**
 * The drawing sized by its box: the root fills the element, so the element's class says how big it is. A `width` or
 * `height` on the root would say otherwise — or, absent with only a `viewBox`, let it grow to the whole line.
 */
export const fitSvg = (markup: string): string =>
  markup.replace(ROOT_TAG, tag =>
    tag
      .replace(/\s(width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/^<svg\b/i, '<svg width="100%" height="100%"')
  );
