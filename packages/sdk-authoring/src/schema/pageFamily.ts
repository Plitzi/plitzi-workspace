import { markWrittenAt } from './writtenAt';
import { scope } from '../elements/scope';

import type { ElementSpec, LayoutRef, PageSpec } from './types';

const FAMILY = Symbol('plitzi.pageFamily');

/**
 * The family a page was written by, when it was: one object shared by its pages and no others. Carried unseen — a
 * page spec is the author's, and what it says is all a document is made of.
 */
export const familyOf = (page: PageSpec): object | undefined => {
  const family: unknown = Reflect.get(page, FAMILY);

  return typeof family === 'object' && family !== null ? family : undefined;
};

/** What one page of a family says that its siblings do not. */
export interface PageFamilyEntry {
  /** The page's id — and the prefix of every id its body gives, so two pages of the family never share one. */
  id: string;
  /** Its name in the builder, and its document title unless the family words one (`seoTitle`). */
  title: string;
  /** Its path, relative to the family's folder. */
  slug: string;
  /** Its meta description, and its share preview's. */
  description?: string;
}

/** What every page of a family shares: where it lives, what frames it, how it is titled, and the shape of its body. */
export interface PageFamily<Entry extends PageFamilyEntry> {
  folder?: string;
  layout?: LayoutRef;
  accessLevel?: PageSpec['accessLevel'];
  /** The document title: `entry => \`${entry.title} — Docs\``. The entry's own title when absent. */
  seoTitle?: (entry: Entry) => string;
  /**
   * One page's body, built inside `scope(entry.id, …)`: an `id` given here is the page's own (`id: 'title'` is
   * `<entry.id>-title`), and `ref` is the full name, for whatever names one — a binding, a step's target, a template.
   */
  body: (entry: Entry, ref: (id: string) => string) => ElementSpec[];
}

/**
 * Pages of one shape, each from its entry — the docs pages from their list, a menu's sections, a team's profiles.
 *
 * A function a space writes for itself does the same, and every space wrote the same one: the id, the slug, the titles,
 * the folder, the layout, and the prefix every id inside needs, because ids are one namespace for the whole space and
 * two pages of one shape give the same ones. Here it is once: the entries are data — an array in `src/data/`, typed —
 * and adding a page is adding an entry. Two entries with one id or one slug are refused as any two pages are.
 *
 * For one shape over a collection the visitor browses — a product, a post — a single page with a route param
 * (`slug: 'posts/:postId'`) reading the record is the answer instead: one page, as many addresses as records, and
 * nothing to author per record.
 */
export const pageFamily = <Entry extends PageFamilyEntry>(
  { folder, layout, accessLevel, seoTitle, body }: PageFamily<Entry>,
  entries: readonly Entry[]
): PageSpec[] => {
  const family = {};

  // Each page placed where the family is written — a refusal of one of them names that line — and known as one of it:
  // what its pages share is written once, and is no copy of anything (`repeated-shape`).
  return entries.map(entry => {
    const page = markWrittenAt<PageSpec>({
      id: entry.id,
      name: entry.title,
      slug: entry.slug,
      seoTitle: seoTitle ? seoTitle(entry) : entry.title,
      ...(entry.description ? { seoDescription: entry.description } : {}),
      ...(folder ? { folder } : {}),
      ...(layout ? { layout } : {}),
      ...(accessLevel ? { accessLevel } : {}),
      body: scope(entry.id, ref => body(entry, ref))
    });
    Object.defineProperty(page, FAMILY, { value: family, enumerable: false });

    return page;
  });
};
