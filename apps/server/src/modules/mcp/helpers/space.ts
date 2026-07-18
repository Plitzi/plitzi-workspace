import type { AIElementDetail } from '../types';
import type { ComponentCatalog, Element, PageFolder, Schema, Style } from '@plitzi/sdk-shared';

/** The working view the tools read and mutate: the two Plitzi schemas (elements + style), which the platform
 *  stores and persists as separate documents (Space model / Style model). `catalog` is read-only reference data
 *  (plugin element-type semantics), not persisted — used only to enrich the plitzi://types resource. */
export interface Space {
  schema: Schema;
  style: Style;
  catalog?: ComponentCatalog;
}

// Only the two schemas are mutated by an apply, so only they are deep-copied for the all-or-nothing draft. The
// catalog is read-only reference data an op never touches — sharing its reference avoids a needless deep clone of
// every plugin manifest on every write.
export const cloneSpace = (space: Space): Space => ({
  schema: structuredClone(space.schema),
  style: structuredClone(space.style),
  ...(space.catalog ? { catalog: space.catalog } : {})
});

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || '';

/** A value when it is a string, otherwise undefined — for the many attributes typed as `unknown` that are strings
 *  in practice (name, slug, subType, dom id…). */
export const strOr = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** Display name of a page or element: its `name` attribute when set, otherwise its definition label. */
export const nameOf = (el: Element): string => strOr(el.attributes.name) ?? el.definition.label;

/** Stable, human-readable ref for a page: its idRef, then slug, then a slugified label. A page without an idRef is
 *  still addressable — unlike a data source, a page ref has meaningful fallbacks the agent can read off the tree. */
export const pageRefOf = (el: Element): string => {
  if (el.idRef) {
    return el.idRef;
  }

  const slug = strOr(el.attributes.slug)?.trim();
  if (slug) {
    return slugify(slug);
  }

  if (el.attributes.default === true) {
    return 'home';
  }

  return slugify(nameOf(el)) || el.id;
};

/** Stable ref for ADDRESSING a non-page element in the tree: its idRef when present, otherwise the opaque id so an
 *  element without one is still reachable — the agent needs to name it to give it an idRef in the first place.
 *  This is not the wiring key: the runtime wires interactions and data sources by idRef only, so an element
 *  addressed here by its id alone publishes no source and takes no interactions (see `getSourceName`). */
export const elementRefOf = (el: Element): string => el.idRef ?? el.id;

// --- Per-request index -------------------------------------------------------------------------------------------
// The scanners below (isPageElement/find*/resolveRef/pageRefOfElement) are called a lot — per validated op, per
// dispatched op, per search hit — and each used to re-scan schema.flat (some O(flat × pages)). This index resolves
// all of them in O(1) after a single O(flat) build. It is memoized on the Schema OBJECT identity, so it lives and
// dies with the space a request loaded (the MCP is stateless: a new request reads a fresh space object and builds
// its own index). The apply draft is a structuredClone — a different object with its own entry — and every schema
// mutation in the dispatch loop calls `invalidateIndex`, so a scanner never reads a stale index.

/** A memoized element projection: its full detail and the stateVersion (content hash) derived from it, plus the
 *  style object they were computed against (a different style ref forces a recompute). */
export interface ElementVersion {
  style: Style;
  detail: AIElementDetail;
  version: string;
}

export interface SpaceIndex {
  /** Ids of the page elements (schema.pages ∪ every element whose type is 'page'). */
  pageIds: Set<string>;
  /** The page elements, in schema.flat insertion order (what getPageElements returns). */
  pageElements: Element[];
  /** page ref (idRef/slug/label) AND raw page id → the page element. First writer wins on a ref collision. */
  pageByRef: Map<string, Element>;
  /** non-page idRef AND raw id → the element. First writer wins on a ref collision. */
  elementByRef: Map<string, Element>;
  /** Any element id (page root or nested descendant) → the id of the page it belongs to. */
  pageOf: Map<string, string>;
  /** element id → its memoized detail/version, so a page-skeleton hash, a search hit and a follow-up element read
   *  all resolve the same element once. Populated lazily by `elementView`; dropped whole on `invalidateIndex`. */
  detailCache: Map<string, ElementVersion>;
}

const buildIndex = (schema: Schema): SpaceIndex => {
  const flat = schema.flat;
  // items may reference a dangling id (rsc placeholders, stale entries); read through a nullable view.
  const lookup = (id: string): Element | undefined => flat[id];

  const pageIds = new Set<string>(schema.pages);
  for (const el of Object.values(flat)) {
    if (el.definition.type === 'page') {
      pageIds.add(el.id);
    }
  }

  const pageElements: Element[] = [];
  const pageByRef = new Map<string, Element>();
  const elementByRef = new Map<string, Element>();
  for (const el of Object.values(flat)) {
    if (pageIds.has(el.id)) {
      pageElements.push(el);
      const ref = pageRefOf(el);
      if (!pageByRef.has(ref)) {
        pageByRef.set(ref, el);
      }

      if (!pageByRef.has(el.id)) {
        pageByRef.set(el.id, el);
      }
    } else {
      const ref = elementRefOf(el);
      if (!elementByRef.has(ref)) {
        elementByRef.set(ref, el);
      }

      if (!elementByRef.has(el.id)) {
        elementByRef.set(el.id, el);
      }
    }
  }

  const pageOf = new Map<string, string>();
  for (const page of pageElements) {
    pageOf.set(page.id, page.id);
    const stack = [...(page.definition.items ?? [])];
    while (stack.length > 0) {
      const id = stack.pop();
      if (id === undefined || pageOf.has(id)) {
        continue;
      }

      const el = lookup(id);
      if (!el) {
        continue;
      }

      pageOf.set(id, page.id);
      for (const childId of el.definition.items ?? []) {
        stack.push(childId);
      }
    }
  }

  return { pageIds, pageElements, pageByRef, elementByRef, pageOf, detailCache: new Map() };
};

const indexCache = new WeakMap<Schema, SpaceIndex>();

/** The index for a schema, built once and memoized on the schema object. */
export const spaceIndex = (schema: Schema): SpaceIndex => {
  let index = indexCache.get(schema);
  if (!index) {
    index = buildIndex(schema);
    indexCache.set(schema, index);
  }

  return index;
};

/** Drop the memoized index wholesale. A correctness fallback for a mutation with no dedicated incremental updater;
 *  the next scanner rebuilds against current state. Prefer the index* helpers below, which keep a built index in
 *  step in O(1) — a large structural batch would otherwise pay an O(flat) rebuild after every op. */
export const invalidateIndex = (schema: Schema): void => {
  indexCache.delete(schema);
};

// --- Incremental index maintenance -------------------------------------------------------------------------------
// The mutation primitives call these so a single dispatch batch builds the index at most ONCE (on first ref lookup)
// and then patches it per op in O(1), instead of invalidating and rebuilding O(flat) every op. Each no-ops when no
// index is cached yet — the mutation is already in schema.flat, so a later first build reflects it. detailCache is
// cleared on any structural change: it is only ever populated by reads (which never interleave with the dispatch
// mutations), so clearing costs nothing there and keeps neighbor entries — a parent's childRefs, a moved element's
// parentRef, a renamed page's descendant pageRefs — from silently going stale.

const cachedIndex = (schema: Schema): SpaceIndex | undefined => indexCache.get(schema);

/** A new non-page element was created under `pageId`. */
export const indexAddElement = (schema: Schema, el: Element, pageId: string): void => {
  const index = cachedIndex(schema);
  if (!index) {
    return;
  }

  index.elementByRef.set(el.id, el);
  if (el.idRef) {
    index.elementByRef.set(el.idRef, el);
  }

  index.pageOf.set(el.id, pageId);
  index.detailCache.clear();
};

/** These non-page elements were deleted (an element and its descendants). */
export const indexRemoveElements = (schema: Schema, els: Element[]): void => {
  const index = cachedIndex(schema);
  if (!index) {
    return;
  }

  for (const el of els) {
    index.elementByRef.delete(el.id);
    if (el.idRef) {
      index.elementByRef.delete(el.idRef);
    }

    index.pageOf.delete(el.id);
  }

  index.detailCache.clear();
};

/** An existing element was just given an idRef (it had none), so it becomes addressable by that ref. */
export const indexReRefElement = (schema: Schema, el: Element): void => {
  const index = cachedIndex(schema);
  if (!index) {
    return;
  }

  if (el.idRef) {
    index.elementByRef.set(el.idRef, el);
  }

  index.detailCache.clear();
};

/** A new page element was created. */
export const indexAddPage = (schema: Schema, page: Element): void => {
  const index = cachedIndex(schema);
  if (!index) {
    return;
  }

  index.pageIds.add(page.id);
  index.pageElements.push(page);
  index.pageByRef.set(page.id, page);
  index.pageByRef.set(pageRefOf(page), page);
  index.pageOf.set(page.id, page.id);
  index.detailCache.clear();
};

/** A page and its `descendants` (its non-page elements) were deleted. */
export const indexRemovePage = (schema: Schema, page: Element, descendants: Element[]): void => {
  const index = cachedIndex(schema);
  if (!index) {
    return;
  }

  index.pageIds.delete(page.id);
  const at = index.pageElements.findIndex(p => p.id === page.id);
  if (at >= 0) {
    index.pageElements.splice(at, 1);
  }

  index.pageByRef.delete(page.id);
  index.pageByRef.delete(pageRefOf(page));
  index.pageOf.delete(page.id);
  for (const el of descendants) {
    index.elementByRef.delete(el.id);
    if (el.idRef) {
      index.elementByRef.delete(el.idRef);
    }

    index.pageOf.delete(el.id);
  }

  index.detailCache.clear();
};

/** A page's slug/name/default changed; re-key its pageByRef entry if that changed its ref. `oldRef` is the ref
 *  computed BEFORE the attribute change. */
export const indexReRefPage = (schema: Schema, page: Element, oldRef: string): void => {
  const index = cachedIndex(schema);
  if (!index) {
    return;
  }

  const newRef = pageRefOf(page);
  if (newRef !== oldRef) {
    index.pageByRef.delete(oldRef);
    index.pageByRef.set(newRef, page);
    // Every descendant's projected pageRef changed with it, so their memoized detail is stale.
    index.detailCache.clear();
  }
};

/** A move reparented an element within its page: the ref/page maps are unchanged, but the moved element's
 *  parentRef and both parents' childRefs did change, so their memoized detail must be dropped. */
export const indexInvalidateDetails = (schema: Schema): void => {
  cachedIndex(schema)?.detailCache.clear();
};

export const isPageElement = (schema: Schema, el: Element): boolean =>
  spaceIndex(schema).pageIds.has(el.id) || el.definition.type === 'page';

export const getPageElements = (schema: Schema): Element[] => spaceIndex(schema).pageElements;

/** Finds a page by its semantic ref (idRef/slug/…) or its raw id, so legacy schemas without an idRef still resolve. */
export const findPageByRef = (schema: Schema, pageRef: string): Element | undefined =>
  spaceIndex(schema).pageByRef.get(pageRef);

/** Find any non-page element by its semantic ref (idRef) or raw id, across the whole space. */
export const findElementByRef = (schema: Schema, ref: string): Element | undefined =>
  spaceIndex(schema).elementByRef.get(ref);

// --- Page folders (the sidebar tree). A folder has no idRef; its ref is its id. Pages reference a folder by that
// id (attributes.folder), and nested folders via parentId. ---

// The Schema type declares pageFolders as always present, but a legacy/partial document may omit it — initialize
// defensively so every reader/writer sees an array. (The types can't express the legacy case, hence the disable.)
export const pageFoldersOf = (schema: Schema): PageFolder[] => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  schema.pageFolders ??= [];

  return schema.pageFolders;
};

/** Resolve a folder by its id, or (for agent convenience) by an exact name or slug when that is unambiguous. */
export const findFolderByRef = (schema: Schema, ref: string): PageFolder | undefined => {
  const folders = pageFoldersOf(schema);
  const byId = folders.find(f => f.id === ref);
  if (byId) {
    return byId;
  }

  const byName = folders.filter(f => f.name === ref);
  if (byName.length === 1) {
    return byName[0];
  }

  const bySlug = folders.filter(f => f.slug === ref);

  return bySlug.length === 1 ? bySlug[0] : undefined;
};

/** Order folders so every parent precedes its children — the invariant the schema validator enforces on
 *  pageFolders (a parentId must appear earlier in the array). Cycles (rejected upstream) are left in place. */
export const sortFolders = (folders: PageFolder[]): PageFolder[] => {
  const byId = new Map(folders.map(f => [f.id, f]));
  const placed = new Set<string>();
  const result: PageFolder[] = [];

  const visit = (folder: PageFolder, ancestry: Set<string>): void => {
    if (placed.has(folder.id)) {
      return;
    }

    const parent = folder.parentId ? byId.get(folder.parentId) : undefined;
    if (parent && !ancestry.has(parent.id)) {
      visit(parent, new Set(ancestry).add(folder.id));
    }

    if (!placed.has(folder.id)) {
      placed.add(folder.id);
      result.push(folder);
    }
  };

  for (const folder of folders) {
    visit(folder, new Set([folder.id]));
  }

  return result;
};

/** Ancestor ids of a folder (following parentId), stopping on a cycle. Used to reject a parent change that would
 *  make a folder its own ancestor. */
export const folderAncestorIds = (folders: PageFolder[], startParentId: string | undefined): string[] => {
  const byId = new Map(folders.map(f => [f.id, f]));
  const chain: string[] = [];
  const seen = new Set<string>();
  let current = startParentId ? byId.get(startParentId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return chain;
};

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
 *  semantic ref (idRef) or the raw element id, so schemas predating idRef keep working through their ids. */
export const resolveRef = (schema: Schema, page: Element, ref: string): Element | undefined => {
  if (elementRefOf(page) === ref || pageRefOf(page) === ref || page.id === ref) {
    return page;
  }

  const index = spaceIndex(schema);
  const el = index.elementByRef.get(ref);

  return el && index.pageOf.get(el.id) === page.id ? el : undefined;
};

/** Ordered children of an element, honoring definition.items and skipping dangling ids. */
export const orderedChildren = (schema: Schema, el: Element): Element[] => {
  const ids = el.definition.items ?? [];

  return ids.map(id => schema.flat[id]).filter((child): child is Element => Boolean(child));
};

/** The page ref an element belongs to. 'unknown' when it has no page ancestor. */
export const pageRefOfElement = (schema: Schema, el: Element): string => {
  const pageId = spaceIndex(schema).pageOf.get(el.id);
  const page = pageId ? schema.flat[pageId] : undefined;

  return page ? pageRefOf(page) : 'unknown';
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
