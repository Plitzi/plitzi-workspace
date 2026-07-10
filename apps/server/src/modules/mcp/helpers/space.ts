import type { Element, Schema, Style } from '@plitzi/sdk-shared';

/** The working view the tools read and mutate: the two Plitzi schemas (elements + style), which the platform
 *  stores and persists as separate documents (Space model / Style model). */
export interface Space {
  schema: Schema;
  style: Style;
}

export const cloneSpace = (space: Space): Space => structuredClone(space);

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || '';

export const isPageElement = (schema: Schema, el: Element): boolean =>
  schema.pages.includes(el.id) || el.definition.type === 'page';

export const getPageElements = (schema: Schema): Element[] =>
  Object.values(schema.flat).filter(el => isPageElement(schema, el));

/** Stable, human-readable ref for a page. Prefers an agent-chosen aiRef, then slug, then a slugified label. */
export const pageRefOf = (el: Element): string => {
  if (el.definition.aiRef) {
    return el.definition.aiRef;
  }

  const slug = typeof el.attributes.slug === 'string' ? el.attributes.slug.trim() : '';
  if (slug) {
    return slugify(slug);
  }

  if (el.attributes.default === true) {
    return 'home';
  }

  const label = typeof el.attributes.name === 'string' ? el.attributes.name : el.definition.label;

  return slugify(label) || el.id;
};

/** Stable ref for a non-page element. An agent-chosen aiRef when present, otherwise the opaque id. */
export const elementRefOf = (el: Element): string => el.definition.aiRef ?? el.id;

/** Finds a page by its semantic ref (aiRef/slug/…) or its raw id, so legacy schemas without an aiRef still resolve. */
export const findPageByRef = (schema: Schema, pageRef: string): Element | undefined =>
  getPageElements(schema).find(el => pageRefOf(el) === pageRef || el.id === pageRef);

/** Route params a page's slug binds (e.g. ":spaceId/update/*" → ["spaceId"]). These are valid {{name}}
 *  references on that page even though they are not space-level schema variables. */
export const slugRouteParams = (slug: string): string[] => {
  const params: string[] = [];
  for (const segment of slug.split('/')) {
    if (segment.startsWith(':')) {
      params.push(segment.slice(1).replace(/[*+?]+$/, ''));
    }
  }

  return params;
};

/** Every route param bound by any page slug in the space (union), so {{name}} validation does not false-flag a
 *  page-scoped dynamic binding. */
export const routeParamNames = (schema: Schema): string[] => {
  const params = new Set<string>();
  for (const page of getPageElements(schema)) {
    const slug = typeof page.attributes.slug === 'string' ? page.attributes.slug : '';
    for (const param of slugRouteParams(slug)) {
      params.add(param);
    }
  }

  return [...params];
};

/** Indexed lookup that reflects the runtime reality: a flat id may be dangling (rsc placeholders, stale items). */
export const elementById = (schema: Schema, id: string): Element | undefined => schema.flat[id];

/** All element ids belonging to a page subtree (excluding the page root). */
const collectDescendants = (schema: Schema, rootId: string, acc: string[]): void => {
  const el = elementById(schema, rootId);
  if (!el) {
    return;
  }

  const childIds = el.definition.items ?? [];
  for (const childId of childIds) {
    if (elementById(schema, childId)) {
      acc.push(childId);
      collectDescendants(schema, childId, acc);
    }
  }
};

export const descendantIds = (schema: Schema, pageRootId: string): string[] => {
  const acc: string[] = [];
  collectDescendants(schema, pageRootId, acc);

  return acc;
};

/** Resolve a ref to a concrete element within a page subtree (or the page root itself). Accepts either the
 *  semantic ref (aiRef) or the raw element id, so schemas predating aiRef keep working through their ids. */
export const resolveRef = (schema: Schema, page: Element, ref: string): Element | undefined => {
  if (elementRefOf(page) === ref || pageRefOf(page) === ref || page.id === ref) {
    return page;
  }

  for (const id of descendantIds(schema, page.id)) {
    const el = elementById(schema, id);
    if (el && (elementRefOf(el) === ref || el.id === ref)) {
      return el;
    }
  }

  return undefined;
};

/** Ordered children of an element, honoring definition.items and skipping dangling ids. */
export const orderedChildren = (schema: Schema, el: Element): Element[] => {
  const ids = el.definition.items ?? [];

  return ids.map(id => schema.flat[id]).filter((child): child is Element => Boolean(child));
};

/** The page ref an element belongs to, walking up parents. 'unknown' when it has no page ancestor. */
export const pageRefOfElement = (schema: Schema, el: Element): string => {
  let current: Element | undefined = el;
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    if (isPageElement(schema, current)) {
      return pageRefOf(current);
    }

    current = current.definition.parentId ? schema.flat[current.definition.parentId] : undefined;
  }

  return 'unknown';
};

/** Find any non-page element by its semantic ref (aiRef) or raw id, across the whole space. */
export const findElementByRef = (schema: Schema, ref: string): Element | undefined => {
  for (const el of Object.values(schema.flat)) {
    if (isPageElement(schema, el)) {
      continue;
    }

    if (elementRefOf(el) === ref || el.id === ref) {
      return el;
    }
  }

  return undefined;
};

/** Total number of descendant elements under a subtree (excluding the root). */
export const descendantCount = (schema: Schema, rootId: string): number => descendantIds(schema, rootId).length;

export const emptySpaceMessage = 'Space data not available';

// Thrown when a space-dependent tool/resource runs but the request carried no resolvable spaceId. The public
// surface (handshake, listings, guide, css-properties) never triggers this.
export const unauthorizedSpaceMessage =
  'This tool/resource needs a space, but no spaceId could be resolved from the Authorization token';

export const generateObjectId = (): string => {
  const ts = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0');
  const rand = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

  return `${ts}${rand}`;
};
