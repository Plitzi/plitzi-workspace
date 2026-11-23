import { set, pick, cloneDeep, get } from '@plitzi/plitzi-ui/helpers';

import { ancestorTypeOf } from '@plitzi/sdk-elements/elements/declarations';
import { documentIds, randomElementId } from '@plitzi/sdk-schema';

import type { ComponentDefinition, Element, Schema } from '@plitzi/sdk-shared';

/** Mints names for a burst of new elements against one snapshot of the document.
 *
 *  A drop can insert a whole sub-tree at once, and each element of it needs a name that is free of the document AND
 *  of its siblings in the same drop — which is why the taken set is carried across the burst rather than re-read
 *  per element. The random minter, not the positional one: the builder and the MCP write the same document
 *  concurrently, and a counter has both mint `heading-3`. Free of every tree — the pages' and each component's — since
 *  ids are one namespace across them. */
export const makeIdMinter = (schema: Pick<Schema, 'flat' | 'components'>) => {
  const taken = documentIds(schema);

  return (type: string) => {
    const id = randomElementId(type, candidate => taken.has(candidate));
    taken.add(id);

    return id;
  };
};

export const getInitialItems = (
  parentId: string,
  items: string[] | undefined,
  definitions: Record<string, ComponentDefinition>,
  mintId: (type: string) => string,
  rootId?: string
): { directItems: Record<string, Element>; items: Record<string, Element> } => {
  let result: Record<string, Element> = {};
  const directItems: Record<string, Element> = {};
  if (!items) {
    return { directItems: {}, items: result };
  }

  items.forEach(item => {
    // A definition's initial tree is stored as definitions; each is read as the element it is placed as, which it is.
    const element = cloneDeep(definitions[item]) as unknown as
      (Pick<ComponentDefinition, 'definition' | 'attributes'> & { id: string; initialItems?: string[] }) | undefined;
    if (!element) {
      return;
    }

    const {
      definition: { items },
      initialItems
    } = element;

    set(element, 'id', mintId(element.definition.type));
    set(element, 'definition.parentId', parentId);
    set(element, 'definition.rootId', rootId);
    let subItems = { directItems: {}, items: {} };
    if (initialItems && !!items) {
      subItems = getInitialItems(element.id, initialItems, definitions, mintId, rootId);
      set(element, 'definition.items', Object.keys(subItems.directItems));
      result = { ...result, ...subItems.items };
    }

    directItems[element.id] = pick(element, ['id', 'attributes', 'definition']);
    result[element.id] = directItems[element.id];
  });

  return { directItems, items: result };
};

/** The categories in the order the panel lists them: what a page is made of first, the escape hatches last. */
const CATEGORY_ORDER = ['basic', 'structure', 'form', 'media', 'provider', 'user'];
const LAST_CATEGORY = 'advanced';

/** How each known category is shown: a name and an icon. A plugin's own category reads as it is written. */
const CATEGORY_DISPLAY: Readonly<Partial<Record<string, { label: string; icon: string }>>> = {
  basic: { label: 'Basic', icon: 'fa-solid fa-font' },
  structure: { label: 'Structure', icon: 'fa-solid fa-table-cells-large' },
  form: { label: 'Form', icon: 'fa-solid fa-rectangle-list' },
  media: { label: 'Media', icon: 'fa-solid fa-photo-film' },
  provider: { label: 'Data', icon: 'fa-solid fa-plug' },
  // Who is visiting: their face, their session, signing in.
  user: { label: 'User', icon: 'fa-solid fa-user' },
  advanced: { label: 'Advanced', icon: 'fa-solid fa-code' }
};

/** How a category is shown: its name and icon — a plugin's own category by the name it gave. */
export const categoryDisplay = (category: string): { label: string; icon: string } =>
  CATEGORY_DISPLAY[category] ?? { label: category, icon: 'fa-solid fa-puzzle-piece' };

const rankOf = (category: string): number => {
  if (category === LAST_CATEGORY) {
    return Number.MAX_SAFE_INTEGER;
  }

  const known = CATEGORY_ORDER.indexOf(category);

  return known === -1 ? CATEGORY_ORDER.length : known;
};

/**
 * A definition's description, cut to its first sentence — up to a full stop, or to a colon that a long one goes on
 * after (said as a full stop): what the panel says of it on hover. A description begins with that sentence; a lead-in
 * such as "An A/B test:" is no summary (`ElementHelper.test.ts` holds every built-in to it).
 */
export const summaryOf = (definition: ComponentDefinition): string => {
  // Declared with the element (what authoring and the MCP describe it by), though the schema's type does not name it.
  const declared = definition.definition;
  const description = 'description' in declared && typeof declared.description === 'string' ? declared.description : '';
  const end = description.search(/[.:](\s|$)/);

  const sentence = end === -1 ? description : `${description.slice(0, end)}.`;

  // A tooltip is plain text: a name written as code (`variantItem`) reads as the name.
  return sentence.replaceAll('`', '');
};

/** What the catalog says of an element on hover: its name, where it goes when it is a part, and what it is. */
export const hoverTextOf = (label: string, summary: string, partOf?: string): string =>
  [label, partOf ? `goes inside ${partOf}` : '', summary].filter(Boolean).join(' — ');

/**
 * The type an element only works somewhere inside — a carousel's track, an A/B test's variant — read where its
 * declaration says it: a plugin's in its manifest, over a built-in type of the same name; a built-in's in its own.
 */
export const ancestorTypeFor = (type: string, registered: ComponentDefinition | undefined): string | undefined =>
  registered && 'manifest' in registered ? registered.ancestorType : ancestorTypeOf(type);

/** The type an element is placed as — a plugin's `type` is its package's, shared by every element it ships. */
const typeOf = (definition: ComponentDefinition): string => definition.definition.type;

/** One element of the catalog, and — when it is a part of another — that element's label: what it goes inside. */
export type CatalogEntry = { definition: ComponentDefinition; partOf?: string };

/**
 * One category's elements by their label, each part right after the element it goes inside — Variants, then its
 * variant — so the catalog shows which is the container. A part whose container is listed elsewhere keeps its place.
 */
const containersFirst = (
  list: ComponentDefinition[],
  definitions: Record<string, ComponentDefinition>
): CatalogEntry[] => {
  const sorted = [...list].sort((a, b) => a.definition.label.localeCompare(b.definition.label));
  const listed = new Set(sorted.map(typeOf));
  const partsOf = new Map<string, ComponentDefinition[]>();
  const roots: ComponentDefinition[] = [];
  for (const definition of sorted) {
    const container = ancestorTypeFor(typeOf(definition), definition);
    if (container && container !== typeOf(definition) && listed.has(container)) {
      partsOf.set(container, [...(partsOf.get(container) ?? []), definition]);
    } else {
      roots.push(definition);
    }
  }

  const entryOf = (definition: ComponentDefinition): CatalogEntry => {
    const container = ancestorTypeFor(typeOf(definition), definition);
    const label =
      container && Object.hasOwn(definitions, container) ? definitions[container].definition.label : undefined;

    return label ? { definition, partOf: label } : { definition };
  };
  const withParts = (definition: ComponentDefinition, seen: Set<string>): CatalogEntry[] => {
    seen.add(typeOf(definition));

    return [
      entryOf(definition),
      ...(partsOf.get(typeOf(definition)) ?? [])
        .filter(part => !seen.has(typeOf(part)))
        .flatMap(part => withParts(part, seen))
    ];
  };
  const seen = new Set<string>();

  return roots.flatMap(definition => withParts(definition, seen));
};

/**
 * The catalog as the elements panel lists it: every definition an author can drag in whose label or type matches
 * `filter`, grouped by category — the categories in the panel's order, the elements in each by their label, each part
 * after its container.
 */
export const definitionsByCategory = (
  definitions: Record<string, ComponentDefinition>,
  filter: string
): [string, CatalogEntry[]][] => {
  const needle = filter.trim().toLowerCase();
  const byCategory = new Map<string, ComponentDefinition[]>();
  for (const definition of Object.values(definitions)) {
    const { label, type } = definition.definition;
    if (!get(definition, 'builder.canDragDrop', true)) {
      continue;
    }

    if (needle && !label.toLowerCase().includes(needle) && !type.toLowerCase().includes(needle)) {
      continue;
    }

    const { category } = definition.market;
    byCategory.set(category, [...(byCategory.get(category) ?? []), definition]);
  }

  return [...byCategory]
    .map(([category, list]): [string, CatalogEntry[]] => [category, containersFirst(list, definitions)])
    .sort(([a], [b]) => rankOf(a) - rankOf(b) || a.localeCompare(b));
};
