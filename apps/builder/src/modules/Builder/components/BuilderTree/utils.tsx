import { get } from '@plitzi/plitzi-ui/helpers';

import type { ComponentDefinition, Element } from '@plitzi/sdk-shared';

type Node = { id: string; label: string; icon: string; parentId?: string; items?: Node[] };

export const recursiveMap = (
  flat: Record<string, Element>,
  componentDefinitions: Record<string, ComponentDefinition>,
  id: string,
  parentId?: string,
  flatItems = {}
): undefined | Node => {
  const element = flat[id] as Element | undefined;
  if (!element) {
    return undefined;
  }

  const {
    definition: { items, label, type }
  } = element;

  const icon = get(componentDefinitions, `${type}.market.icon`, '');
  if (!items) {
    return { id, label, icon, parentId };
  }

  return {
    id,
    label,
    icon,
    parentId,
    items: items.map(item => recursiveMap(flat, componentDefinitions, item, id, flatItems)).filter(Boolean) as Node[]
  };
};
