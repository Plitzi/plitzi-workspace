/* eslint-disable quotes -- the messages quote code, which reads best in the other quotes */
import { declaredClasses } from './declaredClasses';

import type { Suggestion } from './types';
import type { Element, Schema, Style } from '@plitzi/sdk-shared';

/** The elements that draw words of their own: a child that is only those words is an element more than needed. */
const WITH_CONTENT = new Set(['button', 'link']);

/**
 * A rule that gives the text a box of its own: then it is a shape drawn inside the button — a swatch, a mark — and not
 * words the button could say.
 */
const BOX =
  /^(width|height|min-|max-|background|border|padding|margin|position|inset|top|left|right|bottom|transform|display|aspect-ratio)/;

/** The property names a class's rules set, at any breakpoint, selector or state. */
const propertiesOf = (style: Style): Map<string, Set<string>> => {
  const found = new Map<string, Set<string>>();
  const collect = (value: unknown, into: Set<string>): void => {
    if (typeof value !== 'object' || value === null) {
      return;
    }

    for (const [key, inner] of Object.entries(value)) {
      if (typeof inner === 'object' && inner !== null) {
        collect(inner, into);
      } else {
        into.add(key);
      }
    }
  };

  for (const items of Object.values(style.platform)) {
    for (const item of Object.values(items)) {
      if (item.type === 'class') {
        const into = found.get(item.name) ?? new Set<string>();
        collect(item.attributes, into);
        found.set(item.name, into);
      }
    }
  }

  return found;
};

/** A child that does something of its own — a binding, a flow, a condition, children — would not move with the words. */
const isBusy = ({ definition }: Element): boolean =>
  Object.values(definition.bindings ?? {}).some(list => list.length > 0) ||
  Object.keys(definition.interactions ?? {}).length > 0 ||
  definition.initialState?.visibility === false ||
  (definition.items?.length ?? 0) > 0;

/** An icon that is only decoration, the size of the words: what the element's own `icon` draws. */
const isPlainIcon = ({ attributes }: Element): boolean =>
  !attributes.label && (attributes.size ?? 'fa-1x') === 'fa-1x' && !attributes.iconAnimation;

/**
 * A button or a link holding only its words and an icon — a `text`, a `fontAwesome`, or both — the commonest
 * elements spent for nothing. The words are its own `content` and the icon its `icon`; a child that does something of
 * its own (a binding, a flow, a condition), an icon that means something (`label`) or is sized or animated, and a
 * text that is a drawn shape are left alone, since none of that would move with them.
 */
export const suggestContent = (schema: Schema, style: Style): Suggestion[] => {
  const { flat } = schema;
  const declared = declaredClasses(style);
  const properties = propertiesOf(style);
  const found: { id: string; saves: number; classed: boolean; icon: boolean }[] = [];
  for (const [id, element] of Object.entries(flat)) {
    const items = element.definition.items ?? [];
    if (!WITH_CONTENT.has(element.definition.type) || items.length === 0 || items.length > 2) {
      continue;
    }

    const children = items.map(item => flat[item]);
    const texts = children.filter(child => child.definition.type === 'text');
    const icons = children.filter(child => child.definition.type === 'fontAwesome');
    const text = texts.at(0);
    const icon = icons.at(0);
    const onlyThese = texts.length <= 1 && icons.length <= 1 && texts.length + icons.length === children.length;
    if (!onlyThese || children.some(isBusy) || (icon && !isPlainIcon(icon))) {
      continue;
    }

    // Every element is given a class generated from its id; only the space's own classes are something to move.
    const classes = text ? text.definition.styleSelectors.base.split(/\s+/).filter(name => declared.has(name)) : [];
    const words = !text || (typeof text.attributes.content === 'string' && text.attributes.content.trim() !== '');
    const drawn = classes.some(name => [...(properties.get(name) ?? [])].some(property => BOX.test(property)));
    if (words && !drawn) {
      found.push({ id, saves: children.length, classed: classes.length > 0, icon: Boolean(icon) });
    }
  }

  if (found.length === 0) {
    return [];
  }

  const classed = found.filter(entry => entry.classed);
  const iconed = found.filter(entry => entry.icon);
  const example = found[0].id;

  return [
    {
      code: 'content-attribute',
      elementIds: found.map(entry => entry.id),
      saves: found.reduce((sum, entry) => sum + entry.saves, 0),
      message:
        `${String(found.length)} button${found.length === 1 ? '' : 's'} or link${found.length === 1 ? '' : 's'} ` +
        `hold only their words${iconed.length > 0 ? ' and an icon' : ''} as elements ("${example}"${found.length > 1 ? ' and the rest' : ''}): the words are ` +
        "their own `content` — `button({ content: 'Save' })`, `link({ href: '/pricing', content: 'Pricing' })`" +
        (iconed.length > 0
          ? ` — and the icon (${String(iconed.length)} of them) its \`icon\`: \`icon: 'fa-solid fa-arrow-right'\`, ` +
            "`iconPlacement: 'after'` for one after the words, and the class it wore on the `icon` slot " +
            '(`slots: { icon: arrow }`)'
          : '') +
        ` — the element alone instead of it and its children.${
          classed.length > 0
            ? ` Where the text wears a class (${String(classed.length)} of them), what it adds moves to the button's ` +
              "or link's class: a rule the box does not already have (`whiteSpace: 'nowrap'`). A rule saying " +
              "`inherit` was the text taking the box's own, and one only a child needs (`pointerEvents: 'none'`, " +
              'which passes a press through to the box) would switch the box itself off: both go with the text — never ' +
              'put that class on the box.'
            : ''
        }`
    }
  ];
};
