import { didYouMean } from '../suggest';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

/** What a slot the type does not have is answered with: the one it meant, and the ones there are. */
const unknownSlot = (where: string, type: string, slot: string, slots: readonly string[]): string =>
  `${where} names the slot "${slot}", which a ${type} does not have${didYouMean(slot, slots) || '.'} ` +
  (slots.length > 0
    ? `Its slots: ${slots.join(', ')}; the element itself takes \`class\`.`
    : `A ${type} has no slots: give the element itself the class, with \`class\`.`);

/**
 * A class on a slot its element's type does not have dresses no part of it: the element renders no node under that
 * name, so the rule is never seen. A typo (`feild`), or a slot of another type. An empty one is no class at all.
 *
 * Open where the type's slots are not known — a plugin nobody handed the declaration of, a `custom` host whose
 * component decides.
 */
export const checkSlots = (ctx: LintContext, element: Element, where: string): void => {
  const type = ctx.catalogType(element);
  const slots = type === undefined ? undefined : ctx.catalogs.slotNames?.[type];
  if (type === undefined || !slots) {
    return;
  }

  for (const [slot, classes] of Object.entries(element.definition.styleSelectors)) {
    if (slot !== 'base' && classes && !slots.includes(slot)) {
      ctx.error('element-slot-unknown', unknownSlot(where, type, slot, slots), element.id);
    }
  }
};

/** The same, for what a space writes for a whole type (`elements.<type>.slots`): a style item per breakpoint. */
export const lintTypeSlots = (ctx: LintContext): void => {
  const slotNames = ctx.catalogs.slotNames;
  if (!slotNames) {
    return;
  }

  // Once per type and slot, whichever breakpoints say it.
  const reported = new Set<string>();
  for (const items of Object.values(ctx.style.platform)) {
    for (const item of Object.values(items)) {
      const type = item.componentType ?? item.name;
      const slots = item.type === 'element' && Object.hasOwn(slotNames, type) ? slotNames[type] : undefined;
      if (!slots) {
        continue;
      }

      for (const slot of Object.keys(item.attributes)) {
        const key = `${type}.${slot}`;
        if (slot === 'base' || slots.includes(slot) || reported.has(key)) {
          continue;
        }

        reported.add(key);
        ctx.error('element-slot-unknown', unknownSlot(`\`elements.${type}.slots\``, type, slot, slots));
      }
    }
  }
};
