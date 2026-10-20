import { isRecord } from '@plitzi/sdk-shared/helpers';
import { processSelector } from '@plitzi/sdk-style/helpers';

import { didYouMean } from '../suggest';
import { writtenAt } from '../writtenAt';

import type { StyleDeclaration } from '../../style';
import type { SourceIndex } from '../bindings';
import type { ComponentSpec, LayoutRef, PageSpec } from '../types';
import type { FlatMap } from '@plitzi/sdk-schema';
import type { Element, StyleItem } from '@plitzi/sdk-shared';

/** What a page field nobody takes was probably for: the page's own fields for search, or a setting of the space. */
export const pageFieldHint = (key: string): string => {
  if (['seo', 'title', 'description'].includes(key)) {
    return ' A page’s title and description for search engines and shared links are `seoTitle` and `seoDescription`.';
  }

  return ['keepState', 'transientState', 'paintedState', 'stateStorage'].includes(key)
    ? ' Keeping state across visits is a setting of the whole space: `settings: { keepState: true }`, with `transientState` for the keys to leave out.'
    : '';
};

/**
 * The end of a refusal for a folder nobody declared: the name it may have meant, or how to declare it — a folder is a
 * segment of the address its pages answer at, so a misspelt one is never declared on the author's behalf.
 */
export const undeclaredFolder = (folder: string, declared: Iterable<string>, written?: object): string => {
  const at = written === undefined ? undefined : writtenAt(written);

  return `${didYouMean(folder, declared) || `. Declare it on the space: \`pageFolders: [{ id: '${folder}', name: '…' }]\``}${at === undefined ? '' : ` (${at})`}.`;
};

/** A `styles()` declaration in words: its name, and the line of the author's that wrote it when it is known. */
export const declaredAt = (declaration: StyleDeclaration): string => {
  const at = writtenAt(declaration);

  return `styles('${declaration.name}')${at === undefined ? '' : ` at ${at}`}`;
};

/**
 * A component in words, with where it is written: its declaration is an object no factory marks, so it is placed by
 * its root — the call next to everything else it declares. Read defensively: this names it in the very refusals that
 * say its shape is wrong.
 */
export const componentWhere = (component: ComponentSpec): string => {
  const root: unknown = component.root;
  const at = typeof root === 'object' && root !== null ? writtenAt(root) : undefined;
  const id: unknown = component.id;

  return `Component "${String(id)}"${at === undefined ? '' : ` (declared at ${at}, by its root)`}`;
};

/** The types that render their children once per item: everything inside one is repeated, one copy per row. */
export const REPEATING_TYPES = new Set(['list', 'carouselTrack']);

/**
 * Where an element is written: the pages' tree, or one component's — with the sources an element there can read. A
 * component is closed, so its index holds only what its own tree publishes, and `props` is one of its globals.
 */
export type AuthorTree = { map: FlatMap; sources: SourceIndex; globals: readonly string[] };

/**
 * What the elements above one put it under: nothing (`shown`), a condition, or the choice of an element that chooses
 * its children — `chosen` for one of those children, `shownWith` for what is inside one under no condition of its own.
 */
export type Above = 'shown' | 'condition' | 'chosen' | { shownWith: string };

/**
 * What an element puts its children under. An element that chooses them makes each `chosen` — unless a condition above
 * it already holds them, which no choice of its own can lift.
 */
export const aboveChildren = (conditional: boolean, shownWith: string | undefined, chooses: boolean): Above => {
  if (chooses && (!conditional || shownWith !== undefined)) {
    return 'chosen';
  }

  if (shownWith !== undefined) {
    return { shownWith };
  }

  return conditional ? 'condition' : 'shown';
};

/** The chosen element `id` is drawn with: itself when it is one, the one it is inside otherwise. */
export const shownWithOf = (above: Above, id: string): string | undefined => {
  if (above === 'chosen') {
    return id;
  }

  return typeof above === 'object' ? above.shownWith : undefined;
};

/**
 * How a person finds an element in what they wrote: its own name when it has one, otherwise the steps from the nearest
 * one that does — `"store-footer" › container[1] › text[0]` rather than a path of indices from the page down.
 */
export const placeOf = (spec: unknown, parent: string, index?: number): string => {
  const record = isRecord(spec) ? spec : {};
  if (typeof record.id === 'string') {
    return `"${record.id}"`;
  }

  return index === undefined
    ? parent
    : `${parent} › ${typeof record.type === 'string' ? record.type : 'element'}[${index}]`;
};

/**
 * Authoring a space without the builder.
 *
 * The parts a person actually decides — a tree, some CSS, what happens on click — are declared as specs, and every
 * selector name and back-reference is derived from them. An element's id is either the name the author gave it or
 * `<type>-<n>` counted per type, both deterministic — so authoring the same space twice writes byte-identical
 * documents and a seed can re-run without churning what it wrote last time.
 *
 * Insertion goes through `FlatMap`, so a tree built here is held to exactly the same validity and naming rules as
 * one built by dragging elements around the builder, and the finished pair is put through the document validator
 * and the linter before it is handed back — the same gate every space goes through, whoever wrote it. This module is
 * the only thing in the SDK that writes a schema document: every other authoring fragment produces specs, and specs
 * are inert until they reach here.
 */

/** A selector's cache, written by the same function the style editor writes it with — states and variants included. */
export const withCache = (item: Omit<StyleItem, 'cache'>): StyleItem => {
  const complete: StyleItem = { ...item, cache: '' };
  complete.cache = processSelector(complete);

  return complete;
};

/** The two attributes a page or a layout names its shell with. */
/**
 * A page's attributes that are one field of its `PageSpec` each, by attribute name: the page writes `seoTitle` and the
 * document reads `seoPageTitle`. What an edit of a page's attribute writes in the code. Its layout is not here — two
 * attributes from one field (`layout: { id, slot }`) — nor `seoEnabled`, which follows from the other two.
 */
export const PAGE_SPEC_FIELDS: Readonly<Record<string, keyof PageSpec>> = {
  slug: 'slug',
  name: 'name',
  default: 'isDefault',
  folder: 'folder',
  accessLevel: 'accessLevel',
  access: 'access',
  seoPageTitle: 'seoTitle',
  seoPageDescription: 'seoDescription',
  notFound: 'notFound',
  documentScroll: 'documentScroll'
};

export const layoutAttributes = (layout: LayoutRef | undefined): Record<string, string> =>
  layout ? { layout: layout.id, layoutContainer: layout.slot } : {};

/** The lists an element is drawn in once per row — a list with `items`, innermost first: what its anchors are named by. */
export const rowsOf = (flat: Record<string, Element>, id: string): string[] => {
  const rows: string[] = [];
  const parentOf = (of: string): string | undefined =>
    Object.hasOwn(flat, of) ? (flat[of].definition.parentId ?? undefined) : undefined;
  for (let at = parentOf(id); at && Object.hasOwn(flat, at); at = parentOf(at)) {
    const element = flat[at];
    if (element.definition.type === 'list' && element.attributes.source === 'controlled') {
      rows.push(at);
    }
  }

  return rows;
};
