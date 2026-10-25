import chalk from 'chalk';

import { atInitial, comparable, differences, MEASURED, PSEUDO_MEASURED, PSEUDOS } from './measureValues';

import type { Reading } from './measure';
import type { Measured } from './measureValues';

/**
 * What `page measure` prints of what it read: an element alone, its properties; a pair, what differs here → there and
 * the rest the same, what each pair is compared on and when the other page was kept said once above them all.
 */
const named = (each: Measured): string => `${each.tag}${each.text ? ` "${each.text}"` : ''} (${each.selector})`;

/** What a line and a tracking are of their font: the rule that writes them, where pixels say one size's result. */
const EM_RELATIVE = new Set(['line-height', 'letter-spacing']);

/**
 * A line height or a tracking as a share of the element's own font size — `22.13px` is `1.5em` of 14.75px: the value to
 * write once for every size, where a developer copying the pixels tried three (a run's VS text).
 */
const emOf = (property: string, value: string, side: Measured): string => {
  const size = Number.parseFloat(side.styles['font-size'] ?? '');
  const pixels = Number.parseFloat(value);
  if (!EM_RELATIVE.has(property) || !value.endsWith('px') || !(size > 0) || !Number.isFinite(pixels)) {
    return '';
  }

  return chalk.dim(` (${String(Math.round((pixels / size) * 1000) / 1000)}em)`);
};

/** A document's body measured on a space's page: where the space's own type is, to measure instead. */
const rootNote = (here: Measured): string[] =>
  here.spaceRoot
    ? [
        chalk.dim(
          `  ${here.tag} is the document's: the space dresses its root, ${here.spaceRoot} — measure it, "${here.spaceRoot} => ${here.tag}"`
        )
      ]
    : [];

/** The pseudo-elements a pair was compared on: what "the rest the same" covers beyond `MEASURED`. */
const pseudosOf = (here: Measured, there: Measured): string[] =>
  PSEUDOS.filter(pseudo => [here, there].some(side => Object.hasOwn(side.styles, `${pseudo}:content`)));

/**
 * What every pair of a reading is compared on, said once above them — each pair then says what differs and "the rest
 * the same". A pair said the other page's address and its 25 properties alike, 470 characters of 900, and
 * a reading of six pairs said them six times; an agent read each again on every turn after.
 */
export const comparedText = (url: string | undefined): string =>
  chalk.dim(
    `${url ? `Beside ${url} (there) — each` : 'Each'} compared on ${MEASURED.join(', ')}, and the ${PSEUDOS.map(pseudo => `::${pseudo}`).join('/')} either page has (${PSEUDO_MEASURED.join(', ')}): below, what differs`
  );

/** Whether a pair's properties are those `comparedText` says: a side asked alone (`--same margin-bottom`) is not. */
const saidAbove = (same: readonly string[]): boolean =>
  same.every(property => (MEASURED as readonly string[]).includes(property) || property.includes(':'));

/** A picture written into a value (`url(data:image/svg+xml,…)`) said by its kind and size: thousands of characters a value. */
const withoutData = (value: string): string =>
  value.replace(
    /url\((["'])data:([\w/+.-]+)[;,][\s\S]*?\1\)|url\(data:([\w/+.-]+)[;,][^)]*\)/g,
    (match, _quote: string | undefined, quoted: string | undefined, bare: string | undefined) =>
      `url(data:${quoted ?? bare ?? ''} … ${String(match.length)} chars)`
  );

/** A value's layers — a background's, a shadow's — at its commas outside brackets. */
const layersOf = (value: string): string[] => {
  const layers: string[] = [];
  let depth = 0;
  let from = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charAt(index);
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (char === ',' && depth === 0) {
      layers.push(value.slice(from, index).trim());
      from = index + 1;
    }
  }

  return [...layers, value.slice(from).trim()];
};

/**
 * A value as a reading says it: a picture written into it by its kind and size, and a layer drawn again and again
 * once with how many times — a ::before's four rivets were one radial-gradient written four times, 600 characters.
 */
const shortValue = (value: string): string => {
  const runs: { layer: string; times: number }[] = [];
  for (const layer of layersOf(withoutData(value))) {
    const last = runs.at(-1);
    if (last?.layer === layer) {
      last.times += 1;
    } else {
      runs.push({ layer, times: 1 });
    }
  }

  return runs.map(({ layer, times }) => (times > 1 ? `${layer} ×${String(times)}` : layer)).join(', ');
};

/** Four sides read apart, and the shorthand a person writes them with when they are alike. */
const SIDE_GROUPS: readonly { shorthand: string; sides: readonly string[] }[] = [
  { shorthand: 'border', sides: ['border-top', 'border-right', 'border-bottom', 'border-left'] },
  { shorthand: 'inset', sides: ['top', 'right', 'bottom', 'left'] }
];

/**
 * Four sides alike said as one line — `border: 2px solid …`, a ::before's `inset: 6px` — on the element and on each of
 * its pseudo-elements.
 */
const sidesJoined = (entries: [string, string][]): [string, string][] =>
  ['', ...PSEUDOS.map(pseudo => `${pseudo}:`)].reduce(
    (joined, prefix) =>
      SIDE_GROUPS.reduce((current, { shorthand, sides }) => {
        const named = sides.map(side => `${prefix}${side}`);
        const values = named.map(property => current.find(([each]) => each === property)?.[1]);
        const [first] = values;
        if (first === undefined || values.some(value => value !== first)) {
          return current;
        }

        return current.flatMap(([property, value]): [string, string][] =>
          property === named[0]
            ? [[`${prefix}${shorthand}`, value]]
            : named.includes(property)
              ? []
              : [[property, value]]
        );
      }, joined),
    entries
  );

const HIDDEN = 'a visitor sees none of what it finds — its box and place are not on the page';

/**
 * One element read alone: what it says of itself — a property at its initial value and one taken from its parent left
 * out, unless every one is asked (`all`). A run's measures printed ~40 properties an element, a data URI whole in
 * each: 38k characters in one answer, read again on every turn after it.
 */
const aloneText = (here: Measured, all: boolean): string => {
  const entries = Object.entries(here.styles);
  const shown = all
    ? entries
    : sidesJoined(
        entries.filter(([property, value]) => !atInitial(property, value) && !here.inherited.includes(property))
      );
  const initial = entries.filter(([property, value]) => atInitial(property, value)).length;
  const inherited = entries.filter(([property]) => here.inherited.includes(property)).length;

  return [
    chalk.bold(named(here)),
    ...rootNote(here),
    ...(here.hidden ? [chalk.yellow(`  hidden: ${HIDDEN}`)] : []),
    ...(here.matches === undefined
      ? []
      : [chalk.dim(`  (the first shown of ${String(here.matches)} it finds — --rows measures each)`)]),
    ...shown.map(
      ([property, value]) =>
        `  ${property.padEnd(22)} ${all ? value : shortValue(value)}${here.inherited.includes(property) ? chalk.dim('  (inherited)') : ''}`
    ),
    ...(!all && initial + inherited > 0
      ? [
          chalk.dim(
            `  (${[initial > 0 ? `${String(initial)} at their initial value` : '', inherited > 0 ? `${String(inherited)} inherited from its parent` : ''].filter(Boolean).join(', ')}: --all says them)`
          )
        ]
      : [])
  ].join('\n');
};

export const measuredText = (here: Measured, there?: Measured, all = false): string => {
  if (!there) {
    return aloneText(here, all);
  }

  const { differ, same } = differences(here, there);
  const own = differ.filter(each => !each.inherited);
  const inherited = differ.filter(each => each.inherited);
  const pseudos = pseudosOf(here, there);
  const rest = saidAbove(same)
    ? `  the rest the same${pseudos.length > 0 ? ` (its ${pseudos.map(pseudo => `::${pseudo}`).join(' and ')} too)` : ''}`
    : `  the same: ${same.join(', ')}`;

  return [
    chalk.bold(`${named(here)} here → ${named(there)} there`),
    ...rootNote(here),
    ...(here.hidden || there.hidden
      ? [
          chalk.yellow(
            `  hidden ${here.hidden && there.hidden ? 'on both pages' : here.hidden ? 'here' : 'there'}: ${HIDDEN}`
          )
        ]
      : []),
    ...(differ.length === 0 ? ['  every property measured is the same'] : []),
    ...own.map(
      each =>
        `  ${chalk.yellow('≠')} ${each.property.padEnd(22)} ${each.here}${emOf(each.property, each.here, here)}  →  ${each.there}${emOf(each.property, each.there, there)}`
    ),
    // What the page's type gives every element: said once, so what this element itself does differently is read first.
    ...(inherited.length > 0
      ? [
          chalk.dim(
            `  ≈ inherited from its parent on both pages, differs: ${inherited.map(each => `${each.property} ${comparable(each.property, each.here)} → ${comparable(each.property, each.there)}`).join('; ')}`
          )
        ]
      : []),
    ...(differ.length > 0 && same.length > 0 ? [chalk.dim(rest)] : [])
  ].join('\n');
};

const minutesAgo = (at: string, now: number): string =>
  `${String(Math.max(0, Math.round((now - Date.parse(at)) / 60_000)))} min ago`;

/** When the other page's readings were kept, said once above them all when it is one time for all. */
export const keptText = (readings: readonly Reading[], now: number): string | undefined => {
  const times = new Set(readings.map(reading => (reading.keptAt ? minutesAgo(reading.keptAt, now) : undefined)));
  const [time] = times;

  return times.size === 1 && time !== undefined
    ? chalk.dim(`(there: read ${time} and kept — --fresh reads it again)`)
    : undefined;
};

/**
 * What one reading says: its element measured, or why not — and, held to `--same`, whether it holds. The other page,
 * and the time it was kept when it is one for all, are said above every reading (`comparedText`, `keptText`).
 */
export const readingText = (
  reading: Reading,
  same: string[] | undefined,
  now: number,
  keptSaid = false,
  all = false
) => {
  const { here, there } = reading;
  if ('problem' in here) {
    return chalk.red(`✗ ${here.problem}`);
  }

  if (there && 'problem' in there) {
    return chalk.red(`✗ there: ${there.problem}`);
  }

  return [
    measuredText(here, there, all),
    ...(reading.keptAt && !keptSaid
      ? [chalk.dim(`  (there: read ${minutesAgo(reading.keptAt, now)} and kept — --fresh reads it again)`)]
      : []),
    ...(same
      ? [
          reading.unlike.length > 0
            ? chalk.red(
                `✗ --same: ${reading.unlike.map(each => `${each.property} ${each.here} → ${each.there}`).join('; ')}`
              )
            : chalk.green(
                `✓ --same: ${same.length > 4 ? `the ${String(same.length)} asked` : same.join(', ')} as the other page's`
              ),
          ...(reading.inherited
            ? [
                chalk.dim(
                  `  (left out of --same, inherited from its parent on both pages: ${reading.inherited.map(each => `${each.property} ${each.here} → ${each.there}`).join('; ')} — measure the parent to hold it)`
                )
              ]
            : [])
        ]
      : [])
  ].join('\n');
};
