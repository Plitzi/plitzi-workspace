import { selectorFor } from '@plitzi/sdk-authoring';

import type { Authored } from './space';
import type { ContestedStyle, ElementStyles } from './types';
import type { BrowserPage } from '../../browser';
import type { Element as SchemaElement } from '@plitzi/sdk-shared';

/**
 * `--element`: how an element's classes meet on it, at rest — the property each sets, which wins, which change nothing.
 */

/**
 * Each property more than one of an element's classes sets, as the page has them at rest, and which one wins. Which
 * wins is asked of the page rather than worked out from the cascade: each class is taken off for a moment, and the one
 * whose absence changes the value is the one it comes from — specificity, order, layers and media all answered at once.
 * Runs in the page, self-contained.
 */
export const contestedStylesInPage = ({
  selector,
  classes
}: {
  selector: string;
  classes: string[];
}): Omit<ElementStyles, 'wornBy' | 'partOf'> | null => {
  const node = document.querySelector(selector);
  if (!(node instanceof HTMLElement)) {
    return null;
  }

  const worn = classes.filter(name => node.classList.contains(name));
  const declared = new Map<string, { className: string; value: string }[]>();
  const visit = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        if (matchMedia(rule.media.mediaText).matches) {
          visit(rule.cssRules);
        }

        continue;
      }

      if (rule instanceof CSSSupportsRule) {
        if (CSS.supports(rule.conditionText)) {
          visit(rule.cssRules);
        }

        continue;
      }

      if (!(rule instanceof CSSStyleRule)) {
        if (rule instanceof CSSGroupingRule) {
          visit(rule.cssRules);
        }

        continue;
      }

      let applies = false;
      try {
        applies = node.matches(rule.selectorText);
      } catch {
        // A selector `matches` cannot take — a pseudo-element — is never this node at rest.
      }

      const className = applies
        ? worn.find(name => new RegExp(`\\.${CSS.escape(name)}(?![\\w-])`).test(rule.selectorText))
        : undefined;
      if (!className) {
        continue;
      }

      for (const property of Array.from(rule.style)) {
        const others = (declared.get(property) ?? []).filter(entry => entry.className !== className);
        declared.set(property, [...others, { className, value: rule.style.getPropertyValue(property) }]);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      visit(sheet.cssRules);
    } catch {
      // A stylesheet from another origin cannot be read, and holds none of the space's classes.
    }
  }

  const { transition, animation } = node.style;
  // Off while the classes come and go: a transition would answer the value it starts from, not the one it ends at.
  node.style.transition = 'none';
  node.style.animation = 'none';
  const shownOf = (property: string): string => getComputedStyle(node).getPropertyValue(property);
  // Which of the properties each class sets stays as it is without that class: all of them, and it changes nothing.
  const unchangedWithout = (className: string, properties: readonly string[]): boolean[] => {
    const shown = properties.map(shownOf);
    node.classList.remove(className);
    const without = properties.map(shownOf);
    node.classList.add(className);

    return properties.map((_, index) => without[index] === shown[index]);
  };
  const contested = [...declared]
    .filter(([, list]) => list.length > 1)
    .map(([property, list]): ContestedStyle => {
      const winner = list.find(({ className }) => !unchangedWithout(className, [property])[0])?.className;

      return { property, declared: list, shown: shownOf(property), ...(winner ? { winner } : {}) };
    });
  const inert = worn.flatMap(className => {
    const properties = [...declared].filter(([, list]) => list.some(entry => entry.className === className));
    const names = properties.map(([property]) => property);

    return names.length > 0 && unchangedWithout(className, names).every(Boolean)
      ? [{ className, properties: names.length }]
      : [];
  });
  node.style.transition = transition;
  node.style.animation = animation;

  return { contested, inert, copies: document.querySelectorAll(selector).length };
};

/** Contested properties as lines, those that say the same of the same classes said once: a shorthand's longhands. */
export const contestedText = (contested: readonly ContestedStyle[], wornBy: ElementStyles['wornBy']): string[] => {
  const groups = new Map<string, { properties: string[]; style: ContestedStyle }>();
  for (const style of contested) {
    const key = JSON.stringify([style.shown, style.winner, style.declared]);
    const group = groups.get(key);
    if (group) {
      group.properties.push(style.property);
    } else {
      groups.set(key, { properties: [style.property], style });
    }
  }

  return [...groups.values()].map(({ properties, style }) => {
    const named =
      properties.length > 2
        ? `${properties[0]} and ${String(properties.length - 1)} more like it`
        : properties.join(', ');
    const losers = style.declared.filter(({ className }) => className !== style.winner);
    const over = losers.map(({ className, value }) => `${className} says ${value}`).join(', ');

    // Said of the property alone: a class that shares it may set others nobody else does, and be on other elements.
    const shared = style.declared
      .filter(({ className }) => (wornBy[className] ?? []).length > 0)
      .map(({ className }) => othersWearing(className, wornBy));
    const reach = shared.length > 0 ? ` — ${shared.join('; ')}` : '';

    return style.winner
      ? `${named}: ${style.shown}, from ${style.winner} (${over})${reach}`
      : `${named}: ${style.shown} — ${style.declared.map(({ className }) => className).join(' and ')} all set it so; it stays ${style.shown} without any one of them${reach}`;
  });
};

/** Who else a class is on, said where changing the class itself would reach them. */
const othersWearing = (className: string, wornBy: ElementStyles['wornBy']): string => {
  const others = wornBy[className] ?? [];
  if (others.length === 0) {
    return `${className} is on this element alone`;
  }

  const named =
    others.length > 3 ? `${others.slice(0, 3).join(', ')} and ${String(others.length - 3)} more` : others.join(', ');

  return `${className} is also on ${named}: changing the class itself changes ${others.length === 1 ? 'it' : 'them'} too`;
};

/**
 * The classes that change nothing on the element, said with how far that was measured — and what taking one away
 * means: off this element's `class`, which touches no other; never its rules, which every element wearing it reads.
 */
export const inertText = (inert: ElementStyles['inert'], width: number, wornBy: ElementStyles['wornBy']): string[] =>
  inert.map(
    ({ className, properties }) =>
      `${className} changes nothing on it at rest at ${String(width)} px: each of the ${String(properties)} ${properties === 1 ? 'property' : 'properties'} it sets stays as it is without it (a hover or another width may still need it). To drop it here, take it off this element’s \`class\`; ${othersWearing(className, wornBy)}.`
  );

/** The ids of the space nearest `id`: a part of a component is named by its instance, and a typo by what it meant. */
const nearIds = (ids: readonly string[], id: string): string[] =>
  ids
    .filter(
      each => each !== id && (each.includes(id) || id.includes(each) || each.endsWith(id.split('-').at(-1) ?? id))
    )
    .slice(0, 5);

/**
 * The contested styles of the element asked for, by its selector and the classes the space gives it — or why they
 * cannot be read, as it is. A component's part is an element of its component, drawn once per instance under its own
 * name: read on the first copy the page draws, with how many there are (a run's `--element` on a card's part was
 * answered "no element of the space", while `page measure` read it).
 */
export const elementStyles = async (
  page: BrowserPage,
  authored: Authored | undefined,
  id: string
): Promise<ElementStyles | { unread: string }> => {
  if (!authored) {
    return { unread: 'the space could not be authored here, so its classes are unknown' };
  }

  const classesOf = (one: SchemaElement): string[] =>
    Object.values(one.definition.styleSelectors).flatMap(names => names.split(/\s+/).filter(Boolean));
  const everyElement = [
    ...Object.values(authored.schema.flat),
    ...Object.values(authored.schema.components).flatMap(component => Object.values(component.flat))
  ];
  const partOf = Object.values(authored.schema.components).find(component => Object.hasOwn(component.flat, id));
  const element = Object.hasOwn(authored.schema.flat, id) ? authored.schema.flat[id] : partOf?.flat[id];
  if (!element) {
    // A class, found on the page by it: a run's `--element fight-card-vs` was found, then said no element.
    const wearing = everyElement.filter(one => classesOf(one).includes(id));
    if (wearing.length > 0) {
      const named = wearing.slice(0, 5).map(one => one.id);

      return {
        unread: `${id} is a class, not an element — worn by ${named.join(', ')}${wearing.length > named.length ? ` and ${String(wearing.length - named.length)} more` : ''}: name one of them`
      };
    }

    const near = nearIds(
      everyElement.map(one => one.id),
      id
    );

    return {
      unread: `${id} is no element of the space as authored, nor a part of any of its components${near.length > 0 ? `; near it: ${near.join(', ')}` : ''}`
    };
  }

  const classes = classesOf(element);
  const read = await page.evaluate(contestedStylesInPage, { selector: selectorFor(id), classes });
  if (!read) {
    return {
      unread: partOf
        ? `${id} is a part of the component ${partOf.id}, and no instance of it is on the page at this width`
        : `${id} is not on the page at this width`
    };
  }

  const others = everyElement.filter(one => one.id !== id);
  const wornBy = Object.fromEntries(
    classes.map(className => [className, others.filter(one => classesOf(one).includes(className)).map(one => one.id)])
  );

  return { ...read, wornBy, ...(partOf ? { partOf: partOf.id } : {}) };
};
