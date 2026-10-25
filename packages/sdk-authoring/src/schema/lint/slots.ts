import { FormControlDeclaration as formControl } from '@plitzi/sdk-elements/elements/declarations';

import { textOf } from './context';
import { didYouMean } from '../suggest';

import type { LintContext } from './context';
import type { Element, StyleItem, StyleObject, StyleValue } from '@plitzi/sdk-shared';

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

const LEVEL_SLOT = /^heading([1-6])$/;

const classesOf = (selector: string | undefined): string[] => (selector ?? '').split(/\s+/).filter(Boolean);

/** The fields drawn as a box — the `input` slot — with the `<input>` or `<select>` inside it, the `field` slot. */
const BOXED_FIELDS = new Set(
  Object.entries(formControl.content.defaultStyle.subTypes)
    .filter(([, variant]) => 'field' in variant.style)
    .map(([subType]) => subType)
);

const FOCUS_STATES = ['focus', 'focus-visible'];

/**
 * A text field's or a select's `input` slot is the box the field is drawn in, a `<div>` that never takes focus: a
 * `focus` state on its class is never seen, and a keyboard user tabbing to the field finds no ring at all.
 * `focus-within` is the box's own, lit while the field inside has focus.
 */
export const checkFocusOnFieldBox = (ctx: LintContext, element: Element, where: string): void => {
  if (element.definition.type !== 'formControl') {
    return;
  }

  const subType = textOf(element.attributes.subType, textOf(ctx.defaultsFor(element).subType, 'text'));
  if (!BOXED_FIELDS.has(subType)) {
    return;
  }

  for (const className of classesOf(element.definition.styleSelectors.input)) {
    for (const items of Object.values(ctx.style.platform)) {
      const item = Object.hasOwn(items, className) ? items[className] : undefined;
      const states = item?.type === 'class' ? item.attributes.base.states : undefined;
      const state = FOCUS_STATES.find(name => states && Object.hasOwn(states, name));
      if (!state) {
        continue;
      }

      ctx.warn(
        'focus-on-field-box',
        `${where} is a "${subType}" field whose \`input\` slot ("${className}") sets \`${state}\` — but \`input\` is the box the field is drawn in, which never takes focus, so the rule is never seen and a keyboard user finds no ring. Write it as \`'focus-within'\` on the same class (the box lights up while the field inside has focus), or put the state on the \`field\` slot.`,
        element.id
      );

      return;
    }
  }
};

/** A class's own rules at one breakpoint — its base, and each of its states — by where they apply, property by property. */
const classRules = (items: Record<string, StyleItem>, name: string): Map<string, Map<string, StyleValue>> => {
  const item = Object.hasOwn(items, name) ? items[name] : undefined;
  const base = item?.type === 'class' ? item.attributes.base : undefined;
  const byProperty = (rules: StyleObject | undefined): Map<string, StyleValue> => new Map(Object.entries(rules ?? {}));

  return new Map([
    ['', byProperty(base?.default)],
    ...Object.entries(base?.states ?? {}).map(([state, rules]): [string, Map<string, StyleValue>] => [
      `:${state}`,
      byProperty(rules)
    ])
  ]);
};

/**
 * A heading wears its element's `heading` slot and its level's (`heading3`) at once — what every heading shares, and
 * what its level changes. Where both set one property, the stylesheet's order decides, not the slots: the class written
 * later wins, and an `<h3>` showing the size of every heading is the level's rule silently lost. Warned where the
 * level's class is the one that loses.
 */
export const checkHeadingLevels = (ctx: LintContext, element: Element, where: string): void => {
  const selectors = element.definition.styleSelectors;
  const general = classesOf(selectors.heading);
  if (general.length === 0) {
    return;
  }

  for (const [slot, selector] of Object.entries(selectors)) {
    const level = LEVEL_SLOT.exec(slot)?.[1];
    if (!level) {
      continue;
    }

    for (const [mode, items] of Object.entries(ctx.style.platform)) {
      const order = Object.keys(items);
      for (const levelClass of classesOf(selector)) {
        for (const generalClass of general) {
          if (order.indexOf(generalClass) < order.indexOf(levelClass)) {
            continue;
          }

          const levelRules = classRules(items, levelClass);
          for (const [state, rules] of classRules(items, generalClass)) {
            const levelState = levelRules.get(state);
            const lost = [...rules].find(
              ([property, value]) => levelState?.has(property) && levelState.get(property) !== value
            );
            if (!lost) {
              continue;
            }

            const [property, value] = lost;
            ctx.warn(
              'heading-level-overridden',
              `${where}: its \`heading\` slot ("${generalClass}") and its \`${slot}\` slot ("${levelClass}") both set \`${property}\`${state ? ` in \`${state}\`` : ''} (${mode}), and "${generalClass}" is written later in the stylesheet — so every <h${level}> shows ${String(value)}, not ${String(levelState?.get(property))}. Set \`${property}\` on one of them only: on "${levelClass}" for the <h${level}> alone, on "${generalClass}" for every heading.`,
              element.id
            );

            return;
          }
        }
      }
    }
  }
};

/** Where a popup is drawn, set by its dropdown: a class's rule on any of these moves it off its trigger. */
const POPUP_PLACE = ['position', 'top', 'left', 'right', 'bottom', 'inset', 'transform'];

/** The first of `properties` a class sets on an element's own node, at any breakpoint and in any state — and where. */
const setOnBase = (
  ctx: LintContext,
  element: Element,
  properties: readonly string[]
): { className: string; property: string; mode: string } | undefined => {
  for (const className of classesOf(element.definition.styleSelectors.base)) {
    for (const [mode, items] of Object.entries(ctx.style.platform)) {
      for (const rules of classRules(items, className).values()) {
        const property = properties.find(each => rules.has(each));
        if (property) {
          return { className, property, mode };
        }
      }
    }
  }

  return undefined;
};

/**
 * A dropdown's popup is drawn at the space's root, `position: fixed` where its dropdown places it: a class that sets
 * its place moves it off its trigger, silently — a run's header menu was laid in the header's flow, the burger cut
 * off, and only a picture at 390 showed it.
 */
export const checkPopupPosition = (ctx: LintContext, element: Element, where: string): void => {
  if (element.definition.type !== 'dropdownPopup') {
    return;
  }

  const set = setOnBase(ctx, element, POPUP_PLACE);
  if (set) {
    ctx.warn(
      'popup-position-set',
      `${where} is a dropdownPopup whose class "${set.className}" sets \`${set.property}\` (${set.mode}) — but its dropdown draws it at the space's root, fixed where it places it, and the class moves it off its trigger. Give the class its look alone; its place is the dropdown's: \`popupPlacement\`, \`containerTopOffset\`, \`containerLeftOffset\` — and \`popupWidth: 'trigger'\` for a list as wide as its trigger.`,
      element.id
    );
  }
};

/**
 * An icon's glyphs are Font Awesome's font: a class giving it another `font-family` draws a fallback character — a
 * "≡" for a bars icon — and every check passed it (a run's design-2 saw it in a picture).
 */
export const checkIconFont = (ctx: LintContext, element: Element, where: string): void => {
  if (element.definition.type !== 'fontAwesome') {
    return;
  }

  const set = setOnBase(ctx, element, ['font-family']);
  if (set) {
    ctx.warn(
      'icon-font-replaced',
      `${where} is a fontAwesome icon whose class "${set.className}" sets \`font-family\` (${set.mode}) — the icon's glyphs are Font Awesome's font, and another draws a fallback character in their place. Set the font on the text around it; on the icon, its size and colour.`,
      element.id
    );
  }
};
