import type { BrowserPage } from '../../browser';

/**
 * What `page measure --only` reads of an element beyond its CSS, asked by name: an attribute (`attr:role`,
 * `attr:aria-label`), its accessible name, and how far its content runs past its box. A run's agents read a gauge's
 * label in a vendor's `.d.ts`, a slider's tabindex in a library's dist, and estimated by hand whether a log line was cut.
 */

/** How far its content runs, against the box it is shown in: what tells a text cut by an `overflow: hidden`. */
export const METRICS = ['scroll-width', 'scroll-height', 'client-width', 'client-height'] as const;

/** Its name as assistive technology says it. */
export const ACCESSIBLE_NAME = 'accessible-name';

/** An attribute asked by name: `attr:aria-label`. */
export const ATTRIBUTE_ASKED = /^attr:([a-z][\w:-]*)$/i;

export interface Asked {
  attributes: string[];
  metrics: string[];
  accessibleName: boolean;
}

/** Each asked of the element `selector` finds — its first shown, as measured — as the reading's own lines. */
export const askedOn = async (page: BrowserPage, selector: string, asked: Asked): Promise<Record<string, string>> => {
  if (asked.attributes.length === 0 && asked.metrics.length === 0 && !asked.accessibleName) {
    return {};
  }

  return page
    .locator(selector)
    .first()
    .evaluate((node, { attributes, metrics, accessibleName }: Asked) => {
      const read: Record<string, string> = {};
      for (const name of attributes) {
        read[`attr:${name}`] = node.getAttribute(name) ?? 'none';
      }

      const sizes: Record<string, number> = {
        'scroll-width': node.scrollWidth,
        'scroll-height': node.scrollHeight,
        'client-width': node.clientWidth,
        'client-height': node.clientHeight
      };
      for (const metric of metrics) {
        read[metric] = `${String(sizes[metric] ?? 0)}px`;
      }

      // As the accessibility tree names it, in its order: what labels it, then its alternative, then its words.
      if (accessibleName) {
        const labelled = (node.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .map(id => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        const text = node instanceof HTMLElement ? node.innerText : node.textContent;
        const name =
          node.getAttribute('aria-label') ??
          (labelled || null) ??
          node.getAttribute('alt') ??
          node.getAttribute('title') ??
          text;
        read['accessible-name'] = name.replace(/\s+/g, ' ').trim() || 'none';
      }

      return read;
    }, asked)
    .catch(() => ({}));
};
