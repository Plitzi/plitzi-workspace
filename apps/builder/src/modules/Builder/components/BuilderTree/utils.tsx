import { get } from '@plitzi/plitzi-ui/helpers';

import type { ComponentDefinition, Element } from '@plitzi/sdk-shared';

type Node = { id: string; label: string; hint?: string; icon: string; parentId?: string; items?: Node[] };

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
    definition: { items, type }
  } = element;

  // The tree shows the id, because the id IS the name: it is what a binding reads this element by and what an
  // interaction targets, so the tree and the wiring cannot say different things. `definition.label` is free
  // display text, edited in the element panel and wired to nothing.
  const label = element.id;
  const icon = get(componentDefinitions, `${type}.market.icon`, '');
  // What kind of element it is, beside a name that does not say: `hero` reads as a container, `container-7` already does.
  const kind = get(componentDefinitions, `${type}.definition.label`, type);
  const hint = label.toLowerCase().startsWith(type.toLowerCase()) ? undefined : kind;
  if (!items) {
    return { id, label, ...(hint ? { hint } : {}), icon, parentId };
  }

  return {
    id,
    label,
    ...(hint ? { hint } : {}),
    icon,
    parentId,
    items: items.map(item => recursiveMap(flat, componentDefinitions, item, id, flatItems)).filter(Boolean) as Node[]
  };
};
