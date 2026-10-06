import { STYLE_STATES } from '@plitzi/sdk-shared/style/styleStates';

import { shorthandLonghands } from '../../style/shorthand';
import { shorthandOf } from '../../style/shorthandOrigins';

import type { Suggestion } from './types';
import type { ResponsiveBlock } from '../../style/types';
import type { DisplayMode, StyleMode, StyleObject, StyleState, StyleValue } from '@plitzi/sdk-shared';

/** A class one node wears, as authoring declared it — with the shorthands its rules were written with. */
export interface WornClass {
  name: string;
  blocks: ResponsiveBlock;
  /** Its place in the stylesheet: of two rules for one width, the later one wins. */
  order: number;
  /** Where its rules were written, in words: `styles('card') at src/space/styles.ts:4` — asked only to be said. */
  written: () => string;
}

/** The classes one node of an element wears, in the order its class list names them. */
export interface WornList {
  elementId: string;
  classes: WornClass[];
}

/** Which breakpoints' rules apply at each width, in the order the stylesheet writes them (`generateCache`). */
const CASCADE: Record<StyleMode, Record<DisplayMode, DisplayMode[]>> = {
  'desktop-first': { desktop: ['desktop'], tablet: ['desktop', 'tablet'], mobile: ['desktop', 'mobile'] },
  'mobile-first': { mobile: ['mobile'], tablet: ['mobile', 'tablet'], desktop: ['mobile', 'tablet', 'desktop'] }
};

const WIDTHS: DisplayMode[] = ['desktop', 'tablet', 'mobile'];

/** One value a class sets for a longhand at a width, and the shorthand that wrote it when one did. */
interface Candidate {
  worn: WornClass;
  listed: number;
  breakpoint: DisplayMode;
  value: StyleValue;
  shorthand?: string;
}

/** One longhand a class wrote out and another's shorthand erased, at one width and state. */
interface Erased {
  longhand: string;
  shorthand: string;
  won: StyleValue;
  lost: StyleValue;
  width: DisplayMode;
  state?: StyleState;
  /** The winner's rules are a narrower breakpoint's, which the stylesheet writes after the base whatever the order. */
  byBreakpoint: boolean;
}

const rulesOf = (blocks: ResponsiveBlock, breakpoint: DisplayMode, state: StyleState | undefined) => {
  const block = blocks[breakpoint];

  return state === undefined ? block?.default : block?.states?.[state];
};

/**
 * At one width and state, every longhand the node's classes set, each with its values in the order the stylesheet
 * applies them — the last one wins: the breakpoints' rules in cascade order, and within one breakpoint the classes in
 * the order the stylesheet declares them, which is not the class list's.
 */
const candidatesAt = (
  classes: WornClass[],
  layers: DisplayMode[],
  state: StyleState | undefined
): Map<string, Candidate[]> => {
  const byLonghand = new Map<string, Candidate[]>();
  const bySheet = classes.map((worn, listed) => ({ worn, listed })).sort((a, b) => a.worn.order - b.worn.order);
  for (const breakpoint of layers) {
    for (const { worn, listed } of bySheet) {
      const rules: StyleObject | undefined = rulesOf(worn.blocks, breakpoint, state);
      for (const [longhand, value] of Object.entries(rules ?? {})) {
        const shorthand = rules ? shorthandOf(rules, longhand) : undefined;
        byLonghand.set(longhand, [
          ...(byLonghand.get(longhand) ?? []),
          { worn, listed, breakpoint, value, ...(shorthand === undefined ? {} : { shorthand }) }
        ]);
      }
    }
  }

  return byLonghand;
};

/**
 * What one node's classes erase of each other: a longhand a class wrote out, lost to a value another class's shorthand
 * set. Only when the class that wrote it out is listed AFTER the one whose shorthand wins — what a class list reads as
 * "this one on top" — so a modifier whose shorthand resets its base's longhands, and a base whose longhand a modifier
 * writes out on top, both stay quiet.
 */
const erasedOn = (
  classes: WornClass[],
  mode: StyleMode
): Map<string, { winner: WornClass; loser: WornClass; erased: Erased[] }> => {
  const found = new Map<string, { winner: WornClass; loser: WornClass; erased: Erased[] }>();
  for (const width of WIDTHS) {
    const layers = CASCADE[mode][width];
    for (const state of [undefined, ...STYLE_STATES]) {
      for (const [longhand, candidates] of candidatesAt(classes, layers, state)) {
        const winner = candidates[candidates.length - 1];
        if (winner.shorthand === undefined) {
          continue;
        }

        for (const lost of candidates) {
          if (
            lost.worn === winner.worn ||
            lost.shorthand !== undefined ||
            lost.listed < winner.listed ||
            String(lost.value) === String(winner.value)
          ) {
            continue;
          }

          const key = `${winner.worn.name} ${lost.worn.name}`;
          const pair = found.get(key) ?? { winner: winner.worn, loser: lost.worn, erased: [] };
          pair.erased.push({
            longhand,
            shorthand: winner.shorthand,
            won: winner.value,
            lost: lost.value,
            width,
            ...(state === undefined ? {} : { state }),
            byBreakpoint: winner.breakpoint !== lost.breakpoint
          });
          found.set(key, pair);
        }
      }
    }
  }

  return found;
};

/** `padding-top: 0 over 8px at desktop, tablet` — one per longhand, value and state. */
const erasedText = (erased: Erased[]): string => {
  const lines = new Map<string, DisplayMode[]>();
  for (const each of erased) {
    const line = `${each.longhand}${each.state === undefined ? '' : ` (${each.state})`}: ${String(each.won)} over ${String(each.lost)}`;
    const widths = lines.get(line) ?? [];
    if (!widths.includes(each.width)) {
      lines.set(line, [...widths, each.width]);
    }
  }

  return [...lines].map(([line, widths]) => `${line} at ${widths.join(', ')}`).join('; ');
};

const message = (winner: WornClass, loser: WornClass, erased: Erased[], elementIds: string[]): string => {
  const shorthands = [...new Set(erased.map(each => each.shorthand))];
  const longhands = new Set(erased.map(each => each.longhand));
  const meant = shorthands
    .flatMap(shorthand => shorthandLonghands(shorthand) ?? [])
    .filter(longhand => !longhands.has(longhand));
  const others = elementIds.length > 1 ? ` (and ${String(elementIds.length - 1)} more wearing both)` : '';
  const why = erased.some(each => each.byBreakpoint)
    ? `a breakpoint's rules come after the base ones, so "${winner.name}"'s win there whatever the order`
    : `the stylesheet writes "${winner.name}" after "${loser.name}" — classes in the order they are first met, not the order of a class list`;
  const instead =
    meant.length > 0
      ? `the longhands "${winner.name}" means instead of ${shorthands.map(each => `\`${each}\``).join(', ')} (${meant.slice(0, 4).join(', ')}${meant.length > 4 ? ', …' : ''})`
      : `the longhands "${winner.name}" means instead of ${shorthands.map(each => `\`${each}\``).join(', ')}`;

  return `"${winner.name}" (${winner.written()}) erases what "${loser.name}" (${loser.written()}) writes out on "${elementIds[0]}"${others}: its ${shorthands.map(each => `\`${each}\``).join(', ')} sets ${erasedText(erased)} — ${why}. Write ${instead}, so it leaves ${[...longhands].join(', ')} to "${loser.name}"; or, when "${winner.name}" is meant to win, \`quiet: ['class-overrides-class']\` on the element.`;
};

/**
 * One class's shorthand silently erasing a longhand another class of the same node writes out: `card`'s `padding`
 * beating `tight`'s `padding-top` because the stylesheet writes `card` later, or `card`'s mobile `padding` beating it
 * on a phone. Read while the space is authored: the document keeps only longhands, so which were a shorthand is known
 * here alone. One suggestion per pair of classes, with every element wearing both.
 */
export const suggestClassOverrides = (lists: readonly WornList[], mode: StyleMode): Suggestion[] => {
  const pairs = new Map<string, { winner: WornClass; loser: WornClass; erased: Erased[]; elementIds: string[] }>();
  // Most nodes wearing several classes wear the same few lists: each is read once.
  const read = new Map<string, ReturnType<typeof erasedOn>>();
  for (const { elementId, classes } of lists) {
    const list = classes.map(worn => worn.name).join(' ');
    const erasedHere = read.get(list) ?? erasedOn(classes, mode);
    read.set(list, erasedHere);
    for (const [key, { winner, loser, erased }] of erasedHere) {
      const pair = pairs.get(key) ?? { winner, loser, erased, elementIds: [] };
      if (!pair.elementIds.includes(elementId)) {
        pair.elementIds.push(elementId);
      }

      pairs.set(key, pair);
    }
  }

  return [...pairs.values()].map(({ winner, loser, erased, elementIds }) => ({
    code: 'class-overrides-class',
    message: message(winner, loser, erased, elementIds),
    elementIds,
    saves: 0,
    subjects: [winner.name, loser.name]
  }));
};
