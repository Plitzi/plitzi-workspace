import type { StyleItem } from '@plitzi/sdk-shared';

export const selectorFormatter = (selector: string) => {
  if (selector.match(/^[0-9]/)) {
    selector = `_${selector}`;
  }

  return selector.replace(' ', '-').replace(/[^a-zA-Z0-9_-]+/, '');
};

/**
 * The classes of one element in the order the stylesheet lists them, which is the order they win in: where two set the
 * same property, the later one applies. The order they are written on the element decides nothing, so it is not the
 * order they are shown in. A class the stylesheet does not hold keeps its place after the rest.
 */
export const inStylesheetOrder = <T extends { name: string }>(tags: T[], stylesheet: string[]): T[] => {
  const rank = (name: string): number => {
    const index = stylesheet.indexOf(name);

    return index === -1 ? stylesheet.length : index;
  };

  return [...tags].sort((a, b) => rank(a.name) - rank(b.name));
};

export type Overridden = { by: string; properties: string[] };

/** The properties a class sets, its states' as `hover: color`, so the same property in two states is two entries. */
const propertiesOf = (item: StyleItem | undefined): string[] => {
  const base = item?.attributes.base;
  if (!base) {
    return [];
  }

  return [
    ...Object.keys(base.default ?? {}),
    ...Object.entries(base.states ?? {}).flatMap(([state, rules]) =>
      Object.keys(rules).map(property => `${state}: ${property}`)
    )
  ];
};

/**
 * For each class of an element, what a class after it in the stylesheet sets again — the rules it loses wherever both
 * apply. `ordered` is the element's classes in stylesheet order; a class nothing overrides is left out.
 */
export const overriddenProperties = (
  ordered: string[],
  selectors: Record<string, StyleItem>
): Record<string, Overridden[]> => {
  const result: Record<string, Overridden[]> = {};
  ordered.forEach((name, index) => {
    const own = new Set(propertiesOf(selectors[name]));
    const lost = ordered.slice(index + 1).flatMap(later => {
      const properties = propertiesOf(selectors[later]).filter(property => own.has(property));

      return properties.length > 0 ? [{ by: later, properties }] : [];
    });

    if (lost.length > 0) {
      result[name] = lost;
    }
  });

  return result;
};

const SIDES = ['top', 'right', 'bottom', 'left'];

/**
 * A list of properties as a person reads it: the four sides of one box property as that property, so a lost padding
 * reads `padding` rather than four lines of it. What is left of a side set that is not whole stays as written.
 */
export const summarizeProperties = (properties: string[]): string[] => {
  const remaining = new Set(properties);
  const summary: string[] = [];
  for (const property of properties) {
    if (!remaining.has(property)) {
      continue;
    }

    const side = /^(.*?)-(top|right|bottom|left)(-[a-z]+)?$/.exec(property);
    // `at` rather than an index: the suffix group is undefined when it took no part, which only `at` says.
    const suffix = side?.at(3) ?? '';
    const sides = side ? SIDES.map(name => `${side[1]}-${name}${suffix}`) : [];
    if (side && sides.every(name => remaining.has(name))) {
      sides.forEach(name => remaining.delete(name));
      summary.push(`${side[1]}${suffix}`);
      continue;
    }

    remaining.delete(property);
    summary.push(property);
  }

  return summary;
};

/** What the class being edited loses to the classes after it, as one line — or nothing, when it loses nothing. */
export const overrideNote = (
  name: string | undefined,
  overridden: Record<string, Overridden[]>
): string | undefined => {
  const lost = name ? overridden[name] : undefined;
  if (!lost) {
    return undefined;
  }

  return lost
    .map(({ by, properties }) => `${summarizeProperties(properties).join(', ')} overridden by ${by}`)
    .join(' · ');
};
