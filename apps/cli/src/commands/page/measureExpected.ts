import { InvalidArgumentError } from 'commander';

import { PSEUDOS, styleOf } from './measureValues';

import type { Reading } from './measure';

/**
 * `page measure --expect`: what an element must compute a property to — the value, or the least or most a number of
 * it may be — read off its flag and held to what was read.
 */

/** A CSS property's name, as `getComputedStyle` takes it: `overflow-x`, `-webkit-line-clamp`, a pseudo's `after:margin-left`. */
export const PROPERTY_NAME = new RegExp(`^(?:(?:${PSEUDOS.join('|')}):)?-?[a-z][a-z0-9-]*$`);

/**
 * One `--expect`: a property, and the value it must compute to — or, with `at`, the least (`>=`) or most (`<=`) a
 * number of it may be: "the globe is at least 340 px across" held as a line, where a run piped `--json` into `jq`.
 */
export interface PropertyExpected {
  property: string;
  value: string;
  at?: '>=' | '<=';
}

/** An edge or a size of an element's box, in px of the page. */
export const EDGES = ['left', 'right', 'top', 'bottom', 'width', 'height'] as const;

export type Edge = (typeof EDGES)[number];

/** One side of a relation: an element's edge give or take some px, or a number of px alone. */
export interface RelationSide {
  element?: string;
  edge?: Edge;
  px: number;
}

/**
 * Where two elements stand to each other, at every width: `activity.bottom + 8 <= legend-area.top`. A run's every layout
 * line — one row, clear of the corner, above the legend — was ~300 characters of jq over `--json` boxes, read by every
 * agent on every turn.
 */
export interface RelationExpected {
  said: string;
  left: RelationSide;
  at: (typeof RELATIONS)[number];
  right: RelationSide;
}

export type Expected = PropertyExpected | RelationExpected;

const RELATIONS = ['<=', '>=', '<', '>', '='] as const;

const SIDE = new RegExp(
  `^(?:([\\w-]+)\\.(${EDGES.join('|')})\\s*(?:([+-])\\s*(\\d+(?:\\.\\d+)?)(?:px)?)?|(-?\\d+(?:\\.\\d+)?)(?:px)?)$`
);

const sideOf = (text: string): RelationSide | undefined => {
  const match = SIDE.exec(text.trim());
  if (!match) {
    return undefined;
  }

  // A group that did not take part is undefined, whatever the array's type says.
  const [element, edge, sign, offset, alone] = [1, 2, 3, 4, 5].map(group => match.at(group));
  if (alone !== undefined) {
    return { px: Number(alone) };
  }

  const px = offset === undefined ? 0 : Number(offset) * (sign === '-' ? -1 : 1);

  return { element, edge: EDGES.find(each => each === edge), px };
};

/** A relation written as one, or nothing: what names an element's edge (`a.bottom`) on either side is one. */
export const relationOf = (value: string): RelationExpected | undefined => {
  const match = /^(.+?)\s*(<=|>=|<|>|=)\s*(.+)$/.exec(value.trim());
  if (!match || !new RegExp(`[\\w-]\\.(?:${EDGES.join('|')})\\b`).test(value)) {
    return undefined;
  }

  const [, leftText, sign, rightText] = match;
  const [left, right] = [sideOf(leftText), sideOf(rightText)];
  const at = RELATIONS.find(each => each === sign);
  if (!left || !right || !at || (left.element === undefined && right.element === undefined)) {
    throw new InvalidArgumentError(
      `${value}: a relation is two sides — an element's edge (${EDGES.join(', ')}) give or take px, or px alone — and <=, >=, <, > or =: "activity.bottom + 8 <= legend-area.top"`
    );
  }

  return { said: value.trim(), left, at, right };
};

/** The elements relations name, to be measured with those asked. */
export const relationElements = (expected: readonly Expected[]): string[] =>
  expected
    .flatMap(each => ('said' in each ? [each.left.element, each.right.element] : []))
    .filter((element): element is string => element !== undefined);

/** An expectation as it was written. */
export const expectedText = (each: Expected): string =>
  'said' in each ? each.said : `${each.property}${each.at ?? '='}${each.value}`;

/** A side's px from the boxes read, by element: the edge's place, give or take — or the element not read. */
export const sidePx = (
  side: RelationSide,
  boxOf: (element: string) => { x: number; y: number; width: number; height: number } | undefined
): number | { missing: string } => {
  if (side.element === undefined || side.edge === undefined) {
    return side.px;
  }

  const box = boxOf(side.element);
  if (!box) {
    return { missing: side.element };
  }

  const edge = {
    left: box.x,
    right: box.x + box.width,
    top: box.y,
    bottom: box.y + box.height,
    width: box.width,
    height: box.height
  }[side.edge];

  return edge + side.px;
};

/** Whether two px stand as the relation says, to a tenth of a px: a box's edge is a fraction the layout rounds. */
export const relationHolds = (left: number, at: RelationExpected['at'], right: number): boolean => {
  const [a, b] = [Math.round(left * 10) / 10, Math.round(right * 10) / 10];

  return { '<=': a <= b, '>=': a >= b, '<': a < b, '>': a > b, '=': a === b }[at];
};

/** `--expect property=value` (or `>=`, `<=`), or a relation of two elements' edges, each its own flag. */
export const expectedOf = (value: string, previous: Expected[] = []): Expected[] => {
  const relation = relationOf(value);
  if (relation) {
    return [...previous, relation];
  }

  const match = /^([^=<>]+?)\s*(>=|<=|=)([\s\S]*)$/.exec(value);
  const property = match?.[1]?.trim() ?? '';
  const sign = match?.[2];
  const wanted = match?.[3]?.trim() ?? '';
  if (property === '' || !PROPERTY_NAME.test(property)) {
    throw new InvalidArgumentError(
      'takes a CSS property and the value it must compute to — transform=none, after:content="•" — or the least or most a number of it may be, drawn-width>=340px — or where two elements stand, "activity.bottom + 8 <= legend-area.top"; one a flag'
    );
  }

  if (sign !== '=' && Number.isNaN(Number.parseFloat(wanted))) {
    throw new InvalidArgumentError(`${property}${sign ?? ''}${wanted}: >= and <= hold a number — width>=44px`);
  }

  return [...previous, { property, value: wanted, ...(sign === '>=' || sign === '<=' ? { at: sign } : {}) }];
};

/** Whether `actual` is what an expectation asks: the same value, or a number on the side of it the sign says. */
export const holds = (actual: string, { value, at }: PropertyExpected): boolean => {
  if (at === undefined) {
    return valueText(actual) === valueText(value);
  }

  const [have, want] = [Number.parseFloat(actual), Number.parseFloat(value)];

  return !Number.isNaN(have) && (at === '>=' ? have >= want : have <= want);
};

/** A computed value as compared: its spaces as one, so `matrix(1,0,…)` and `matrix(1, 0, …)` read alike. */
const valueText = (value: string): string =>
  value
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Each element read whose property is not the value expected, and each relation that does not hold at a width: a line
 * each, said where the command fails.
 */
export const expectationsMissed = (readings: readonly Reading[], expected: readonly Expected[]): string[] => [
  ...readings.flatMap(({ here, pair, width, scheme }) => {
    if ('problem' in here) {
      return [];
    }

    return expected.flatMap(each => {
      if ('said' in each) {
        return [];
      }

      const { property, value, at } = each;
      const actual = styleOf(here.styles, property);

      return actual !== undefined && holds(actual, each)
        ? []
        : [
            `--expect ${property}${at ?? '='}${value}: ${pair.here} at ${String(width)} px${scheme ? ` ${scheme}` : ''} ${actual === undefined ? 'has none read' : `is ${actual}`}`
          ];
    });
  }),
  ...relationsMissed(readings, expected)
];

/** Each relation that does not hold at a view: what each side read, and by how much it misses. */
const relationsMissed = (readings: readonly Reading[], expected: readonly Expected[]): string[] => {
  const views = [...new Set(readings.map(reading => `${String(reading.width)}|${reading.scheme ?? ''}`))];

  return views.flatMap(view => {
    const here = readings.filter(reading => `${String(reading.width)}|${reading.scheme ?? ''}` === view);
    const [{ width, scheme }] = here;
    const boxOf = (element: string) => {
      const read = here.find(reading => reading.pair.here === element)?.here;

      return read === undefined || 'problem' in read || read.hidden !== undefined ? undefined : read.box;
    };

    return expected.flatMap(each => {
      if (!('said' in each)) {
        return [];
      }

      const [left, right] = [sidePx(each.left, boxOf), sidePx(each.right, boxOf)];
      const at = `at ${String(width)} px${scheme ? ` ${scheme}` : ''}`;
      if (typeof left !== 'number' || typeof right !== 'number') {
        const missing = typeof left === 'number' ? (typeof right === 'number' ? '' : right.missing) : left.missing;

        return [`--expect "${each.said}": ${missing} ${at} has no box read — not drawn there, or hidden`];
      }

      return relationHolds(left, each.at, right)
        ? []
        : [
            `--expect "${each.said}": ${at} ${String(Math.round(left * 10) / 10)} ${each.at} ${String(Math.round(right * 10) / 10)} does not hold — ${String(Math.round(Math.abs(left - right) * 10) / 10)} px apart`
          ];
    });
  });
};
