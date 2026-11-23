import { get } from '@plitzi/plitzi-ui/helpers';

import { variantAt } from '@plitzi/sdk-shared/experiments';
import { builderVariantOf, chooseByOf, VARIANT_ITEM_TYPE, VARIANTS_TYPE } from '@plitzi/sdk-shared/variants';

import type { ComponentDefinition, Element } from '@plitzi/sdk-shared';

type Node = { id: string; label: string; hint?: string; icon: string; parentId?: string; items?: Node[] };

/** The icon of the variant the canvas shows while editing: in the active colour, over the theme's muted one. */
const SHOWN_ICON = 'text-primary-600! dark:text-primary-300!';

/** The icon of a variant the canvas does not show: faded, as an element that is not on screen. */
const OFF_ICON = 'opacity-40';

/**
 * A variant of a Variants element in the tree: which it is — A, B… by chance, 1, 2… by rules — and, while editing,
 * whether it is the one on screen, said by its icon lit and its hint. In the preview the simulated visitor decides, so
 * only which it is is said.
 */
const variantRow = (
  flat: Record<string, Element>,
  id: string,
  parentId: string | undefined,
  icon: string,
  editing: boolean
): { icon: string; hint: string } | undefined => {
  const parent = parentId === undefined ? undefined : (flat[parentId] as Element | undefined);
  if (!parent || parent.definition.type !== VARIANTS_TYPE) {
    return undefined;
  }

  const items = parent.definition.items ?? [];
  const index = items.indexOf(id);
  const mark =
    chooseByOf(parent.attributes) === 'chance'
      ? (variantAt(index)?.toUpperCase() ?? String(index + 1))
      : String(index + 1);
  if (!editing) {
    return { icon, hint: mark };
  }

  const shown = builderVariantOf(parent.attributes, items.length) === index;

  return shown
    ? { icon: `${icon} ${SHOWN_ICON}`, hint: `${mark} · on screen` }
    : { icon: `${icon} ${OFF_ICON}`, hint: mark };
};

export const recursiveMap = (
  flat: Record<string, Element>,
  componentDefinitions: Record<string, ComponentDefinition>,
  id: string,
  editing = true,
  parentId?: string
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
  const typeIcon = get(componentDefinitions, `${type}.market.icon`, '');
  // What kind of element it is, beside a name that does not say: `hero` reads as a container, `container-7` already does.
  const kind = get(componentDefinitions, `${type}.definition.label`, type);
  const variant = type === VARIANT_ITEM_TYPE ? variantRow(flat, id, parentId, typeIcon, editing) : undefined;
  const icon = variant?.icon ?? typeIcon;
  const hint = variant?.hint ?? (label.toLowerCase().startsWith(type.toLowerCase()) ? undefined : kind);
  if (!items) {
    return { id, label, ...(hint ? { hint } : {}), icon, parentId };
  }

  return {
    id,
    label,
    ...(hint ? { hint } : {}),
    icon,
    parentId,
    items: items.map(item => recursiveMap(flat, componentDefinitions, item, editing, id)).filter(Boolean) as Node[]
  };
};
