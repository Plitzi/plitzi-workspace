import type { AIElementDetail } from '../types';
import type {
  ActionEntry,
  ActionTaskDescriptor,
  ComponentCatalog,
  ConnectorEntry,
  Element,
  PageFolder,
  Schema,
  Style
} from '@plitzi/sdk-shared';

/** The working view the tools read and mutate: the two Plitzi schemas (elements + style), which the platform
 *  stores and persists as separate documents (Space model / Style model), plus the space's `connectors` — a third
 *  store (one row per connector) that a provider element points into by identifier. `catalog` is read-only
 *  reference data (plugin element-type semantics), not persisted — used only to enrich the plitzi://types resource. */
export interface Space {
  schema: Schema;
  style: Style;
  connectors: ConnectorEntry[];
  /** The space's server actions — a fourth store, one row each, addressed by the identifier a step names. */
  actions: ActionEntry[];
  /** The server tasks this deployment can run. Read-only reference data like `catalog`, not persisted: it is what
   *  the server has, not what the space owns, and an action authored against a task it lacks cannot run. */
  actionTasks?: ActionTaskDescriptor[];
  catalog?: ComponentCatalog;
}

// The three mutable documents are deep-copied for the all-or-nothing draft. The catalog is read-only reference data
// an op never touches — sharing its reference avoids a needless deep clone of every plugin manifest on every write.
export const cloneSpace = (space: Space): Space => ({
  schema: structuredClone(space.schema),
  style: structuredClone(space.style),
  connectors: structuredClone(space.connectors),
  actions: structuredClone(space.actions),
  ...(space.actionTasks ? { actionTasks: space.actionTasks } : {}),
  ...(space.catalog ? { catalog: space.catalog } : {})
});

// A valid, fully-empty space — no cloud, no page, no styles. The seed a space-independent tool (plitzi_render)
// builds on, and the placeholder context the server hands such a tool so it never triggers a spaceId/auth load.
export const emptySpace = (): Space => ({
  schema: {
    flat: {},
    definition: { name: '', permanentUrl: '' },
    variables: [],
    settings: { customCss: '' },
    pages: [],
    pageFolders: []
  },
  style: {
    platform: { desktop: {}, tablet: {}, mobile: {} },
    theme: { default: 'system', schemes: ['light', 'dark'] },
    variables: {},
    cache: ''
  },
  connectors: [],
  actions: []
});

/** A connector by the identifier a provider element stores in its `connector` attribute. */
export const findConnectorEntry = (space: Space, ref: string): ConnectorEntry | undefined =>
  space.connectors.find(entry => entry.id === ref);

/** An action by the identifier a `runServerAction` step stores. */
export const findActionEntry = (space: Space, ref: string): ActionEntry | undefined =>
  space.actions.find(entry => entry.id === ref);

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

  // No name→element map: an element answers to exactly one name and that name IS its `flat` key, so `schema.flat`
  // already is the index a lookup by name needs. What is left here is what the document does NOT state directly.
  const pageElements: Element[] = [];
  for (const el of Object.values(flat)) {
    if (pageIds.has(el.id)) {
      pageElements.push(el);
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

  return { pageIds, pageElements, pageOf, detailCache: new Map() };
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
// The mutation primitives call these so a single dispatch batch builds the index at most ONCE (on first lookup)
// and then patches it per op in O(1), instead of invalidating and rebuilding O(flat) every op. Each no-ops when no
// index is cached yet — the mutation is already in schema.flat, so a later first build reflects it. detailCache is
// cleared on any structural change: it is only ever populated by reads (which never interleave with the dispatch
// mutations), so clearing costs nothing there and keeps neighbor entries — a parent's children, a moved element's
// parent — from silently going stale.

const cachedIndex = (schema: Schema): SpaceIndex | undefined => indexCache.get(schema);

/** A new non-page element was created under `pageId`. */
export const indexAddElement = (schema: Schema, el: Element, pageId: string): void => {
  const index = cachedIndex(schema);
  if (!index) {
    return;
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
    index.pageOf.delete(el.id);
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

  index.pageOf.delete(page.id);
  for (const el of descendants) {
    index.pageOf.delete(el.id);
  }

  index.detailCache.clear();
};

/** A move reparented an element within its page: the page map is unchanged, but the moved element's parent and
 *  both parents' children did change, so their memoized detail must be dropped. */
export const indexInvalidateDetails = (schema: Schema): void => {
  cachedIndex(schema)?.detailCache.clear();
};

export const isPageElement = (schema: Schema, el: Element): boolean =>
  spaceIndex(schema).pageIds.has(el.id) || el.definition.type === 'page';

export const getPageElements = (schema: Schema): Element[] => spaceIndex(schema).pageElements;

/** Finds a page by its semantic ref (idRef/slug/…) or its raw id, so legacy schemas without an idRef still resolve. */
export const findPageByRef = (schema: Schema, pageId: string): Element | undefined => {
  const el = schema.flat[pageId] as Element | undefined;

  return el && spaceIndex(schema).pageIds.has(el.id) ? el : undefined;
};

/** Find any non-page element by its semantic ref (idRef) or raw id, across the whole space. */
export const findElementByRef = (schema: Schema, id: string): Element | undefined => {
  const el = schema.flat[id] as Element | undefined;

  return el && !spaceIndex(schema).pageIds.has(el.id) ? el : undefined;
};

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
  if (page.id === ref) {
    return page;
  }

  const index = spaceIndex(schema);
  const el = schema.flat[ref] as Element | undefined;

  return el && index.pageOf.get(el.id) === page.id ? el : undefined;
};

/** Ordered children of an element, honoring definition.items and skipping dangling ids. */
export const orderedChildren = (schema: Schema, el: Element): Element[] => {
  const ids = el.definition.items ?? [];

  return ids.map(id => schema.flat[id]).filter((child): child is Element => Boolean(child));
};

/** The page ref an element belongs to. 'unknown' when it has no page ancestor. */
export const pageRefOfElement = (schema: Schema, el: Element): string =>
  spaceIndex(schema).pageOf.get(el.id) ?? 'unknown';

/** Total number of descendant elements under a subtree (excluding the root). */
export const descendantCount = (schema: Schema, rootId: string): number => descendantIds(schema, rootId).length;

export const emptySpaceMessage = 'Space data not available';

/** The code a space-dependent answer carries when the connection reaches no space, so both the agent and a host UI
 *  can tell "this connection cannot do that" from "the call failed". */
export const noSpaceErrorCode = 'NO_SPACE_ATTACHED';

export const readOnlyGrantErrorCode = 'READ_ONLY_GRANT';

// What an agent hears when it asks for something living in a space on a connection that carries none. A connection
// without a space is not advertised the space tools at all (see createMcpServer), so this is the answer to the
// residual cases: a host replaying a tool list it cached, a token that expired mid-session, and the URIs
// plitzi_read is handed. It says what to do instead rather than only what went wrong.
export const unauthorizedSpaceMessage =
  'This connection has no space attached (a guest or widgets-only grant, or a token that carries no space), so ' +
  'NOTHING in a space can be read or edited — every other space tool will fail the same way, do not retry them. ' +
  'Use plitzi_render instead: it builds a self-contained widget offline, with no space, backend or account (read ' +
  'plitzi://render/guide). To edit a real space, the user must reconnect the integration and grant access to one.';

/** Raised when a space-dependent operation runs on a connection that resolves no spaceId. A type of its own so the
 *  host answers it as a STATE of the connection — a plain result the agent reads — instead of letting it surface as
 *  a failed call, which hosts render to the user as "cannot connect to this server". */
export class NoSpaceError extends Error {
  constructor() {
    super(unauthorizedSpaceMessage);
    this.name = 'NoSpaceError';
  }
}

// What an agent hears when it tries to change a space through a bearer that may only read it. The common cause is
// the credential every published site embeds: it names a space, so reads work and the agent has no reason to
// expect the write to fail. Says which credential is needed instead of only that permission was denied.
export const readOnlyGrantMessage =
  'This connection may READ this space but not change it: its token is a read-only (render) credential, or the ' +
  'member who authorized it no longer has permission to edit this space. Every write tool will fail the same way, ' +
  'do not retry them — reads still work. To edit, the user must reconnect the integration and grant edit access.';

/** Raised when a write runs under a grant that carries no write authority. Like NoSpaceError this is a STATE of
 *  the connection rather than a failed call, so the host renders it as a result the agent can act on. */
export class ReadOnlyGrantError extends Error {
  constructor() {
    super(readOnlyGrantMessage);
    this.name = 'ReadOnlyGrantError';
  }
}
