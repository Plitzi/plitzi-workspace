import type { ElementUsage, SpaceReference, UsageItem, UsageTree } from './usageIndex';

export type TreeGroup = { tree: UsageTree; elements: ElementUsage[] };

/** The uses of an item by the tree each is in, in the order the index found them: pages and layouts, then components. */
export const groupByTree = (elements: ElementUsage[]): TreeGroup[] => {
  const groups = new Map<string, TreeGroup>();
  for (const usage of elements) {
    const key = `${usage.tree.kind}:${usage.tree.id}`;
    const group = groups.get(key);
    if (group) {
      group.elements.push(usage);
    } else {
      groups.set(key, { tree: usage.tree, elements: [usage] });
    }
  }

  return [...groups.values()];
};

/** `3 elements in 2 places`, or what reads it when no element does. */
export const usageSummary = (elements: ElementUsage[], references: SpaceReference[]): string => {
  if (elements.length === 0 && references.length === 0) {
    return 'Named in the space, but no element uses it';
  }

  if (elements.length === 0) {
    return `No element; read by ${String(references.length)} in the stylesheet or the settings`;
  }

  const trees = new Set(elements.map(usage => `${usage.tree.kind}:${usage.tree.id}`)).size;

  return `${String(elements.length)} element${elements.length === 1 ? '' : 's'} in ${String(trees)} place${trees === 1 ? '' : 's'}`;
};

/**
 * The count beside a name: the elements that use it; when none does, how many other things read it; and when nothing
 * does but its name is still said somewhere — in prose, a setting — that it is named, which is why it is not unused.
 */
export const usageCount = (item: UsageItem): string => {
  if (item.elements.length > 0) {
    return String(item.elements.length);
  }

  return item.references.length > 0 ? `${String(item.references.length)} ref` : 'named';
};
