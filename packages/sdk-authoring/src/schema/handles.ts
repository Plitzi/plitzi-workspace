import { didYouMean } from './suggest';

/**
 * How a test names what an author wrote.
 *
 * An end-to-end suite has to address a rendered element, and everything it could address one by used to be wrong in
 * the same way: a CSS class is a styling decision that changes when the design does, a text match breaks when the copy
 * is edited, and the `nth-child` chain a recorder produces is invalidated by inserting a section above. What does not
 * move is the element's id — since it is also its NAME, chosen by whoever authored it, and unique across the document.
 *
 * So authoring returns the ids it assigned, and the renderer publishes them as `data-plitzi-el`. A spec written
 * against `handles.element('hero-cta')` cannot drift from the space: the id it names either exists at author time or
 * the build fails, which is exactly one build earlier than the suite would have failed silently.
 */

export interface ElementHandle {
  /** The one name this element answers to: its key in the document, and what `data-plitzi-el` carries. */
  id: string;
  type: string;
  /** The page it lives on, by that page's id. */
  pageId: string;
  /** A CSS selector matching exactly this element in a rendered page. */
  selector: string;
  /**
   * Whether the AUTHOR wrote this id, as opposed to authoring deriving `<type>-<n>` for it.
   *
   * The distinction is what makes a generic assertion possible: a named element is one somebody decided mattered
   * enough to point at, so "everything this space names is on screen" is a contract worth holding it to, while the
   * derived ones are positional and change the moment a section is inserted above them.
   */
  named: boolean;
}

export interface PageHandle extends ElementHandle {
  slug: string;
  /** The route a test navigates to, leading slash included — `/` for the home page. */
  path: string;
  /** Everything on this page, by id. */
  elements: Record<string, ElementHandle>;
}

export interface SpaceHandles {
  /** The pages, by id. */
  pages: Record<string, PageHandle>;
  /** Every element of every page, by id — ids are unique across the whole document. */
  elements: Record<string, ElementHandle>;
  /**
   * One element, by id, or a throw naming what does exist.
   *
   * A throw rather than `undefined`, because the caller is a test: handed nothing, it would build a selector matching
   * nothing and report a missing element on screen, which is a true statement about the wrong thing.
   */
  element(id: string): ElementHandle;
  /** One page, by id or by slug. Throws the same way, for the same reason. */
  page(idOrSlug: string): PageHandle;
}

/**
 * Ids are validated at author time and cannot contain a quote, so this is a formality — but the selector is
 * concatenated into a string a browser parses, and a formality that is written down cannot be forgotten later when
 * the id rules change.
 */
const escapeId = (value: string): string => value.replace(/["\\]/g, '\\$&');

export const selectorFor = (id: string): string => `[data-plitzi-el="${escapeId(id)}"]`;

/** The route for a slug: authoring stores it bare, and everything that navigates wants it absolute. */
export const pathForSlug = (slug: string): string => (slug ? `/${slug}` : '/');

export const buildHandles = (pages: Record<string, PageHandle>): SpaceHandles => {
  const elements: Record<string, ElementHandle> = {};
  for (const page of Object.values(pages)) {
    elements[page.id] = page;
    Object.assign(elements, page.elements);
  }

  const bySlug = new Map(Object.values(pages).map(page => [page.slug, page]));

  return {
    pages,
    elements,
    element(id) {
      // `hasOwn` rather than a falsy check on the lookup: an index signature types every read as a hit, so the
      // question "is this key here at all" is the only one a record can be asked honestly.
      if (!Object.hasOwn(elements, id)) {
        throw new Error(`No element "${id}" in this space${didYouMean(id, Object.keys(elements))}`);
      }

      return elements[id];
    },
    page(idOrSlug) {
      const handle = Object.hasOwn(pages, idOrSlug) ? pages[idOrSlug] : bySlug.get(idOrSlug);
      if (!handle) {
        throw new Error(
          `No page "${idOrSlug}" in this space${didYouMean(idOrSlug, [...Object.keys(pages), ...bySlug.keys()])}`
        );
      }

      return handle;
    }
  };
};

/**
 * The shape this borrows from a browser driver, declared structurally so the package still installs nothing.
 *
 * Playwright's `Page`, Puppeteer's, and a hand-rolled query helper all satisfy it, and the locator that comes back is
 * whichever type that driver returns — so `expect(el('hero-cta'))` keeps its own matchers.
 */
export interface LocatorSource<L> {
  locator(selector: string): L;
}

/**
 * A driver's locator for an authored element, by name.
 *
 * ```ts
 * const el = locate(page, handles);
 * await expect(el('hero-cta')).toBeVisible();
 * ```
 */
export const locate =
  <L>(source: LocatorSource<L>, handles: SpaceHandles) =>
  (id: string): L =>
    source.locator(handles.element(id).selector);
