import { set, pick, cloneDeep, get } from '@plitzi/plitzi-ui/helpers';

import { documentIds } from '@plitzi/sdk-schema/helpers/components';
import { randomElementId } from '@plitzi/sdk-schema/helpers/elementId';

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
const CATEGORY_ORDER = ['basic', 'structure', 'form', 'media', 'provider'];
const LAST_CATEGORY = 'advanced';

/** How each known category is shown: a name and an icon. A plugin's own category reads as it is written. */
const CATEGORY_DISPLAY: Readonly<Partial<Record<string, { label: string; icon: string }>>> = {
  basic: { label: 'Basic', icon: 'fa-solid fa-font' },
  structure: { label: 'Structure', icon: 'fa-solid fa-table-cells-large' },
  form: { label: 'Form', icon: 'fa-solid fa-rectangle-list' },
  media: { label: 'Media', icon: 'fa-solid fa-photo-film' },
  provider: { label: 'Data', icon: 'fa-solid fa-plug' },
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

/** A definition's description, cut to its first sentence: what the panel says of it on hover. */
export const summaryOf = (definition: ComponentDefinition): string => {
  // Declared with the element (what authoring and the MCP describe it by), though the schema's type does not name it.
  const declared = definition.definition;
  const description = 'description' in declared && typeof declared.description === 'string' ? declared.description : '';
  const end = description.search(/[.:](\s|$)/);

  return end === -1 ? description : description.slice(0, end + 1);
};

/**
 * The catalog as the elements panel lists it: every definition an author can drag in whose label or type matches
 * `filter`, grouped by category — the categories in the panel's order, the elements in each by their label.
 */
export const definitionsByCategory = (
  definitions: Record<string, ComponentDefinition>,
  filter: string
): [string, ComponentDefinition[]][] => {
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
    .map(([category, list]): [string, ComponentDefinition[]] => [
      category,
      [...list].sort((a, b) => a.definition.label.localeCompare(b.definition.label))
    ])
    .sort(([a], [b]) => rankOf(a) - rankOf(b) || a.localeCompare(b));
};
