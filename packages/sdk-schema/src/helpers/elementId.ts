import type { Element, Schema } from '@plitzi/sdk-shared';

// Everything an element id needs answered: whether one is well formed, whether a document can take it, minting a
// free one, and moving a set of elements onto new ones. Every check goes through `isValidElementId` — the charset is
// stated once, here, so a caller cannot drift by re-testing its own regex.
//
// An id is the ONE name an element answers to: the `flat` key, what `parentId`/`items`/`rootId` point at, the
// `<type>_<id>` a binding's source is built from, and the target an interaction wires to. It is never absent and
// never opaque — a person types it in the builder's tree, an agent writes it, or it is minted from the element's
// type. Which means a rename is a document-wide operation, and `repointIds` is the single place it happens.

const ELEMENT_ID_RE = /^[A-Za-z](?:[A-Za-z0-9_-]*[A-Za-z0-9_])?$/;

/** True when an element id is well formed: it starts with a letter and then carries letters, numbers, hyphens and
 *  underscores. Leading letter keeps a source `<type>_<id>` a valid twig identifier. A '.' would split the
 *  `<type>_<id>.<field>` source path, an interaction target lookup, and the lodash paths `flat` is read and written
 *  through (`get(flat, id)`, `set(flat, \`${id}.definition.rootId\`)`) — so it is not allowed. A source name uses
 *  the first '_' as separator between `<type>` and `<id>` (element types are camelCase with no underscore), so
 *  underscores inside the id are unambiguous. A hyphen is allowed too: a source doubles as a twig token, and
 *  `processTwig` resolves a hyphenated `<type>_<id>` through `_context` subscript access. */
export const isValidElementId = (id: string): boolean => ELEMENT_ID_RE.test(id);

/** What a person typed, as an id this document can hold. Anything outside the charset becomes a hyphen, runs
 *  collapse, and a leading non-letter is dropped — so a name is editable as prose in the builder's tree and still
 *  lands as a valid key. Empty when nothing usable survives, which the caller reports rather than storing. */
export const slugifyElementId = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[^A-Za-z]+/, '')
    .replace(/-+$/, '');

/** Every id currently in use, so a new one can be checked or minted against it. Uniqueness is per DOCUMENT — a
 *  space schema, and each segment separately — which is what makes a lookup a `flat` key access. A segment used on
 *  several pages repeats its ids in the rendered tree; `rootId`/`referenceId` are what tell those apart. */
export const takenIds = (flat: Record<Element['id'], Element>): Set<string> => new Set(Object.keys(flat));

/** Why `id` cannot be used in this document, phrased for a person, or null when it is free and well formed.
 *  `ignoreElementId` exempts the element being edited, so re-saving an element its own id is not a conflict. */
export const elementIdConflict = (
  flat: Record<Element['id'], Element>,
  id: string,
  ignoreElementId?: Element['id']
): string | null => {
  if (!isValidElementId(id)) {
    return `"${id}" is not a valid name: start with a letter, then letters, numbers, hyphens and underscores`;
  }

  const taken = (flat[id] as Element | undefined) && id !== ignoreElementId;

  return taken ? `"${id}" is already used by another element here` : null;
};

/** Whether every id a write brings INTO a document is free: well formed, not already stored, and not repeated
 *  inside the incoming set — which `elementIdConflict` cannot see on its own, because those elements are not in
 *  `flat` yet. For a rename, where the element IS stored, call `elementIdConflict` with the new name directly. */
export const elementIdsFree = (flat: Record<Element['id'], Element>, elements: Element[]): boolean => {
  const incoming = new Set<string>();
  for (const element of elements) {
    if (incoming.has(element.id) || elementIdConflict(flat, element.id)) {
      return false;
    }

    incoming.add(element.id);
  }

  return true;
};

/** How a document mints an id for an element nobody named. Injected rather than chosen here: a live document wants
 *  uniqueness with no coordination between writers, an authored one wants byte-identical output when re-run, and
 *  the difference is the caller's to state. See `randomElementId` and `positionalElementId`. */
export type MintElementId = (type: string, isTaken: (candidate: string) => boolean) => string;

const idBase = (type: string): string => type.replace(/[^A-Za-z0-9]/g, '') || 'element';

const RANDOM_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** The live-editing minter: `<type>-<4 random chars>`. Random, not positional, because the builder and the MCP
 *  write concurrently — a counter has two collaborators mint `heading-3` and one of the two writes refused at the
 *  merge, which is the worst moment to discover it. At the scale of a document four characters are plenty, and the
 *  name is a default the author renames. */
export const randomElementId: MintElementId = (type, isTaken) => {
  const base = idBase(type);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let suffix = '';
    for (let index = 0; index < 4; index += 1) {
      suffix += RANDOM_ALPHABET[Math.floor(Math.random() * RANDOM_ALPHABET.length)];
    }

    if (!isTaken(`${base}-${suffix}`)) {
      return `${base}-${suffix}`;
    }
  }

  return positionalElementId(type, isTaken);
};

/** The offline-authoring minter: `<type>-<n>`, incrementing until `isTaken` says it is free. Deterministic, so a
 *  seed or a transformer re-run writes the same document it wrote last time and a diff against a committed copy
 *  stays empty. The hyphen sits between two alphanumeric runs, so it is valid and readable. */
export const positionalElementId: MintElementId = (type, isTaken) => {
  const base = idBase(type);
  let n = 1;
  while (isTaken(`${base}-${n}`)) {
    n += 1;
  }

  return `${base}-${n}`;
};

/**
 * `desired` when it is free, else the next number after it — the readable answer to a name collision.
 *
 * A copy of `hero` is `hero-2`, not `container-7`: the whole value of a name is that the copy still says what it
 * is. A name that ALREADY ends in a number counts on from it rather than stacking another one, so a derived
 * `container-1` meeting a `container-1` becomes `container-2` and not `container-1-2`. Names degrading this way is
 * the one cost of a readable unique key, and it is cheaper than the alternative.
 */
export const uniqueElementId = (desired: string, isTaken: (candidate: string) => boolean): string => {
  if (!isTaken(desired)) {
    return desired;
  }

  const numbered = /^(.*[A-Za-z0-9])-(\d+)$/.exec(desired);
  const stem = numbered ? numbered[1] : desired;
  let n = numbered ? Number(numbered[2]) + 1 : 2;
  while (isTaken(`${stem}-${n}`)) {
    n += 1;
  }

  return `${stem}-${n}`;
};

/**
 * Attributes that hold the id of another element in the same document, by element type.
 *
 * They are named here rather than asked of each element's declaration because `sdk-schema` cannot depend on
 * `sdk-elements` — the schema is what the elements are built on. It is a short table on purpose: an attribute that
 * points at another element is a structural reference wearing an attribute's clothes, and there are five of them.
 * An element type adding one adds a line here, or a rename leaves it pointing at a name that no longer exists.
 */
const ID_ATTRIBUTES: Record<string, { attribute: string; when?: (attributes: Element['attributes']) => boolean }[]> = {
  page: [{ attribute: 'layout' }, { attribute: 'layoutContainer' }],
  // `referenceContainer` is deliberately absent: it names an element inside the OTHER document this one points at,
  // so a rename here can never be the rename it needs.
  reference: [{ attribute: 'referenceId', when: attributes => attributes.referenceType === 'element' }],
  link: [{ attribute: 'href', when: attributes => attributes.mode === 'page' }]
};

/** Interaction step params that hold an element id, by the step's action. Same reasoning as `ID_ATTRIBUTES`. */
const ID_STEP_PARAMS: Record<string, { param: string; when?: (params: Record<string, unknown>) => boolean }[]> = {
  navigate: [{ param: 'url', when: params => params.urlType === 'page' }]
};

// Rewrites a data-source name onto a new id. A source is `<type>_<id>` optionally followed by `.<field...>`;
// sources with no `_` are not element-scoped (a Form registers a bare `form`) and are left alone.
const remapSource = (source: string, map: Record<string, string>): string => {
  const dot = source.indexOf('.');
  const head = dot === -1 ? source : source.slice(0, dot);
  const separator = head.indexOf('_');
  if (separator === -1) {
    return source;
  }

  const next = map[head.slice(separator + 1)];
  if (!next) {
    return source;
  }

  return `${head.slice(0, separator + 1)}${next}${dot === -1 ? '' : source.slice(dot)}`;
};

// A source name embedded inside free text: a twig token (`{{ apiContainer_card-1.data.name }}`), a transformer
// param or a query-builder operand. `<type>_<id>` — the id the charset `isValidElementId` states. A bare id is
// never rewritten (that is the corruption this pass guards against: an id is short and readable, so replacing
// "card-1" everywhere would corrupt any label containing it); only a full `<type>_<id>` token is. The regex splits
// on the first `_` (element types are camelCase with no underscore), so an id's underscores are unambiguous.
//
// A flow step's output is addressed by its bare id (`{{ navigate-1.output }}`), which carries no `_` and so is
// never touched here — the two namespaces stay apart by shape rather than by a reserved prefix.
const SOURCE_TOKEN_RE = /([A-Za-z][A-Za-z0-9]*)_([A-Za-z][A-Za-z0-9_-]*)/g;

const remapTokenString = (value: string, map: Record<string, string>): string =>
  value.replace(SOURCE_TOKEN_RE, (match, type: string, id: string) => {
    const next = map[id];

    return next ? `${type}_${next}` : match;
  });

// Rewrites every `<type>_<id>` token found in the string leaves of an arbitrary value — a transformer param tree,
// an interaction's params or a query-builder `when`, whose shapes this pass does not need to know. Writes a leaf
// only when the rename changes it, so an untouched branch never triggers a copy.
const remapTokensDeep = (value: unknown, map: Record<string, string>): boolean => {
  let changed = false;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      if (typeof item === 'string') {
        const next = remapTokenString(item, map);
        if (next !== item) {
          value[index] = next;
          changed = true;
        }

        return;
      }

      changed = remapTokensDeep(item, map) || changed;
    });

    return changed;
  }

  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === 'string') {
      const next = remapTokenString(item, map);
      if (next !== item) {
        record[key] = next;
        changed = true;
      }

      continue;
    }

    changed = remapTokensDeep(item, map) || changed;
  }

  return changed;
};

/**
 * Apply a renaming (old id → new id) across a set of elements: every reference written against the old name, and
 * the elements' own identity.
 *
 * This is what makes an id both readable and safe to change. It is a field-by-field pass, never a string replace
 * over the serialized tree: an id is short and human-readable, so replacing "card-1" everywhere would rewrite it
 * inside labels, prose, class names and content. So each kind of reference is rewritten where it lives —
 * structure (`flat` key, `parentId`, `items`, `rootId`, `pages`), the attributes that point at another element,
 * a binding's `source` and the tokens embedded in its transformers and conditions, and an interaction's target
 * and params.
 *
 * An id absent from the map is left alone, so references leaving this set keep pointing outward, which is what
 * callers want. `pages` is rewritten in place when given — a page rename is not complete without it.
 *
 * Returns the ids, under their new names, of every element it actually wrote to. A caller broadcasting the rename
 * publishes that set: the element being renamed is almost never the whole of what moved.
 */
export const repointIds = (
  flat: Record<Element['id'], Element>,
  map: Record<Element['id'], Element['id']>,
  pages?: Schema['pages']
): Element['id'][] => {
  const renames = Object.entries(map).filter(([from, to]) => from !== to);
  if (renames.length === 0) {
    return [];
  }

  const next = (id: Element['id']): Element['id'] => map[id] ?? id;
  const touched = new Set<Element['id']>();

  for (const element of Object.values(flat)) {
    // Written only where the value actually changes: `flat` is usually an Immer draft, and assigning an unchanged
    // value still marks the element modified — which would copy every element in the document on every rename.
    let changed = false;

    if (map[element.id]) {
      element.id = map[element.id];
      changed = true;
    }

    const { definition, attributes } = element;
    if (map[definition.rootId]) {
      definition.rootId = map[definition.rootId];
      changed = true;
    }

    if (definition.parentId && map[definition.parentId]) {
      definition.parentId = map[definition.parentId];
      changed = true;
    }

    if (definition.items?.some(item => map[item])) {
      definition.items = definition.items.map(next);
      changed = true;
    }

    for (const { attribute, when } of ID_ATTRIBUTES[definition.type] ?? []) {
      const value = attributes[attribute];
      if (typeof value === 'string' && map[value] && (!when || when(attributes))) {
        (attributes as Record<string, unknown>)[attribute] = map[value];
        changed = true;
      }
    }

    for (const bindings of Object.values(definition.bindings ?? {})) {
      for (const binding of bindings) {
        const source = remapSource(binding.source, map);
        if (source !== binding.source) {
          binding.source = source;
          changed = true;
        }

        if (binding.transformers && remapTokensDeep(binding.transformers, map)) {
          changed = true;
        }

        if (binding.when && remapTokensDeep(binding.when, map)) {
          changed = true;
        }
      }
    }

    for (const interaction of Object.values(definition.interactions ?? {})) {
      // elementId is `string | null` (null when the step targets a source/global, not an element), and for a
      // `globalCallback` it holds a source module name — never an element id, so only a mapped one is rewritten.
      if (interaction.elementId && map[interaction.elementId]) {
        interaction.elementId = map[interaction.elementId];
        changed = true;
      }

      for (const { param, when } of ID_STEP_PARAMS[interaction.action] ?? []) {
        const value = interaction.params[param];
        if (typeof value === 'string' && map[value] && (!when || when(interaction.params))) {
          interaction.params[param] = map[value];
          changed = true;
        }
      }

      if (remapTokensDeep(interaction.params, map)) {
        changed = true;
      }

      if (interaction.when && remapTokensDeep(interaction.when, map)) {
        changed = true;
      }
    }

    if (changed) {
      touched.add(element.id);
    }
  }

  // Re-keying happens after the walk and in two passes, so a swap (a→b while b→a) cannot have one write clobber the
  // element the other still has to read.
  const moved = renames.filter(([from]) => (flat[from] as Element | undefined) !== undefined);
  const detached = moved.map(([from, to]) => [to, flat[from]] as const);
  for (const [from] of moved) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete flat[from];
  }

  for (const [to, element] of detached) {
    flat[to] = element;
  }

  if (pages) {
    pages.forEach((pageId, index) => {
      if (map[pageId]) {
        pages[index] = map[pageId];
      }
    });
  }

  return [...touched];
};

/**
 * Renames only the elements of an incoming set whose names this document has already taken, and repoints the set's
 * own references onto the new names.
 *
 * What a template drop and a cross-document paste both need. Renaming everything would be simpler and worse: the
 * names an author gave the template are the reason it is readable, and a document that had no `hero` should get
 * one called `hero`. Returns the renaming it applied, so a caller can report what it had to change.
 */
export const remapCollidingIds = (
  elements: Record<Element['id'], Element>,
  isTaken: (candidate: string) => boolean
): Record<Element['id'], Element['id']> => {
  const map: Record<Element['id'], Element['id']> = {};
  const minted = new Set<string>();
  for (const element of Object.values(elements)) {
    if (!isTaken(element.id)) {
      minted.add(element.id);
      continue;
    }

    // A minted name must also dodge the incoming set itself — including the names of elements not yet walked,
    // which still answer to them.
    const id = uniqueElementId(
      element.id,
      candidate =>
        isTaken(candidate) || minted.has(candidate) || (elements[candidate] as Element | undefined) !== undefined
    );
    minted.add(id);
    map[element.id] = id;
  }

  repointIds(elements, map);

  return map;
};
