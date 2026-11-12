import { resolveLayoutChain } from './layoutChain';
import { pageWithheldOf, withheldPageOf } from './pageAccess';

import type { Element, Schema } from '../types';

/**
 * The space sent in parts: a shell — everything but the pages' and layouts' own elements — and a part
 * per page and per layout, fetched as a page that needs it is opened. A visitor of one page downloads that page and its
 * layouts, not the whole site.
 *
 * The shell keeps every root — each page and layout element itself, with its attributes and its `items` — so the space
 * routes, lists its pages and resolves a page's layouts as the whole did; `schema.parts` names, for each root whose
 * elements are elsewhere, the part that holds them. Only a page server sends it this way: the SDK alone, the builder
 * and the MCP read the whole document, which has no `parts`.
 */

/** The elements of one root (a page or a layout) that the shell leaves out. */
export type DocumentPart = { root: string; flat: Record<string, Element> };

/** A schema split: its shell, and its parts by the name the shell gives them. */
export type SplitSchema = { shell: Schema; parts: ReadonlyMap<string, DocumentPart> };

const attribute = (element: Element | undefined, key: string): string => {
  const value: unknown = element?.attributes[key];

  return typeof value === 'string' ? value : '';
};

/** A page's layouts, innermost first: what must be drawn around it. */
export const pageLayouts = (flat: Schema['flat'], pageId: string): string[] => {
  const page = flat[pageId] as Element | undefined;
  if (!page) {
    return [];
  }

  return resolveLayoutChain(
    id => flat[id] as Element | undefined,
    attribute(page, 'layout'),
    attribute(page, 'layoutContainer')
  ).map(link => link.layout);
};

/**
 * Everything under a root, and everything an element of it copies (`reference`, outside a component) with what is
 * under that: a part carries what its page draws even when it was written on another page.
 */
const elementsOf = (flat: Schema['flat'], root: string, roots: ReadonlySet<string>): Record<string, Element> => {
  const taken: Record<string, Element> = {};
  const pending = [...((flat[root] as Element | undefined)?.definition.items ?? [])];
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || Object.hasOwn(taken, id) || roots.has(id)) {
      continue;
    }

    const element = flat[id] as Element | undefined;
    if (!element) {
      continue;
    }

    taken[id] = element;
    pending.push(...(element.definition.items ?? []));
    const referenceId = attribute(element, 'referenceId');
    if (element.definition.type === 'reference' && referenceId && element.attributes.referenceType !== 'component') {
      pending.push(referenceId);
    }
  }

  return taken;
};

/**
 * The schema as a shell and parts. A page `withheld` from this visitor (`withholdPages`) has no part; nor has a layout no
 * page of theirs is drawn in — a console's shell, to a visitor of the website — which the shell names with `''`: only the
 * server draws it, so a link to such a page loads it from there. `nameOf` names a part by its content.
 */
export const splitSchema = (
  schema: Schema,
  nameOf: (part: DocumentPart) => string,
  withheld: readonly string[] = []
): SplitSchema => {
  const { flat } = schema;
  const roots = new Set(Object.keys(flat).filter(id => flat[id].definition.rootId === id));
  const hidden = new Set(withheld);
  const shown = schema.pages.filter(id => roots.has(id) && !hidden.has(id));
  const layouts = new Set(shown.flatMap(id => pageLayouts(flat, id)));
  const named: Record<string, string> = {};
  const parts = new Map<string, DocumentPart>();
  const left = new Set<string>();
  for (const root of roots) {
    const isPage = schema.pages.includes(root);
    const isLayout = flat[root].definition.type === 'layoutContainer';
    if (!isPage && !isLayout) {
      continue;
    }

    const elements = elementsOf(flat, root, roots);
    if (Object.keys(elements).length === 0) {
      continue;
    }

    for (const id of Object.keys(elements)) {
      left.add(id);
    }

    if ((isPage && hidden.has(root)) || (isLayout && !isPage && !layouts.has(root))) {
      named[root] = '';
      continue;
    }

    const part = { root, flat: elements };
    const name = nameOf(part);
    named[root] = name;
    parts.set(name, part);
  }

  const shellFlat: Record<string, Element> = {};
  for (const [id, element] of Object.entries(flat)) {
    if (!left.has(id) || roots.has(id)) {
      shellFlat[id] = element;
    }
  }

  return { shell: { ...schema, flat: shellFlat, parts: named }, parts };
};

/**
 * The roots a page needs and the shell does not hold: the page's own part and its layouts', by root; the parts of the
 * pages at its address; and, for a page withheld from this visitor, the page the space draws in its place
 * (`settings.withheldPage`). A page at its address that is withheld from this visitor — a part named `''`, its layouts
 * too — is not among them: the router changes to it only once the visitor changes, and a page kept from the visitor the
 * document was sent for is loaded from the server then. Counted, a guest's every link to the home loaded the whole page
 * from the server, for the signed-in home beside it.
 */
export const missingParts = (
  schema: Pick<Schema, 'flat' | 'parts' | 'pages'> & Partial<Pick<Schema, 'settings'>>,
  pageId: string
): string[] => {
  const { parts } = schema;
  if (!parts) {
    return [];
  }

  const page = schema.flat[pageId] as Element | undefined;
  const instead = pageWithheldOf(page?.attributes) ? withheldPageOf(schema) : undefined;
  // The pages at the same address — one per access level — which the router changes between with no navigation, as
  // somebody signs in or out: sent together, or the one it changes to draws empty.
  const addressOf = (element: Element | undefined): string | undefined =>
    typeof element?.attributes.slug === 'string'
      ? `${attribute(element, 'folder')}/${element.attributes.slug}`
      : undefined;
  const address = addressOf(page);
  const together =
    address === undefined
      ? []
      : schema.pages.filter(
          other => other !== pageId && addressOf(schema.flat[other] as Element | undefined) === address
        );
  const own = [pageId, ...pageLayouts(schema.flat, pageId)];
  const beside = together.flatMap(id => [id, ...pageLayouts(schema.flat, id)]).filter(root => parts[root] !== '');

  return [...new Set([...own, ...beside, ...(instead ? [instead] : [])])].filter(root => Object.hasOwn(parts, root));
};

/**
 * The schema with parts put in: their elements in `flat`, their roots off `parts` — a new object, so whatever is kept
 * by the old one (a page's element types) is worked out again. `parts` goes once nothing is left out.
 */
export const withParts = (schema: Schema, added: readonly DocumentPart[]): Schema => {
  if (added.length === 0 || !schema.parts) {
    return schema;
  }

  const flat = { ...schema.flat };
  for (const part of added) {
    Object.assign(flat, part.flat);
  }

  const putIn = new Set(added.map(part => part.root));
  const parts = Object.fromEntries(Object.entries(schema.parts).filter(([root]) => !putIn.has(root)));

  const next: Schema = { ...schema, flat, parts };
  if (Object.keys(parts).length === 0) {
    delete next.parts;
  }

  return next;
};

/** The shell with a page's own part and its layouts' in it: the document a page server sends with that page. */
export const schemaForPage = (split: SplitSchema, pageId: string): Schema =>
  withParts(
    split.shell,
    missingParts(split.shell, pageId).flatMap(root => {
      const name = split.shell.parts?.[root];
      const part = name ? split.parts.get(name) : undefined;

      return part ? [part] : [];
    })
  );
