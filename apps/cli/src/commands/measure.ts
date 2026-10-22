import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';
import { InvalidArgumentError } from 'commander';

import { openPage } from '@plitzi/sdk-authoring';
import { PROJECT_TMP } from '@plitzi/sdk-shared/project';

import { launchBrowser, openProjectPage } from '../browser';
import { projectHere } from './existingProject';
import { originHere } from '../runs/copyServer';
import { targetOn } from './shot/capture';
import { pageAnswered } from './shot/remote';
import { fail } from './terminal';

import type { Browser, BrowserPage, Scheme } from '../browser';

/**
 * `plitzi page measure`: an element's computed styles — what a designer sizes a copy by — and, with `--compare`, the
 * same of an element of another page, beside them. velada-polish's designers wrote Playwright scripts of their own and
 * read the original's CSS by curl for each value they asked a developer for (a size, a weight, a tracking, a border);
 * the comparison of pictures says what differs, never by how much.
 *
 * Its calls are an agent's loop, multiplied: velada-fidelity's developers made ~150 of them at ~18 s each, one element
 * at one width a call, the original loaded whole — and pictured — every time. So one call measures every element asked
 * at every width asked, in one browser; the other page is read without a picture, and what was read of it is kept (it
 * does not change within a run) for the calls after.
 */

/** What is read of each element: its type, its colours, its box's dress, its size, and how it moves. */
export const MEASURED = [
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'color',
  'background-color',
  'background-image',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-radius',
  'box-shadow',
  'text-shadow',
  'opacity',
  'padding',
  'margin',
  'gap',
  'display',
  'width',
  'height',
  'transform',
  'transition'
] as const;

/**
 * What is read of a box's `::before` and `::after`, when it draws one: velada's VS medal paints its fill on `::before`,
 * where a reading of the box alone saw none — and the plan written from it asked the fill away.
 */
const PSEUDO_MEASURED = [
  'content',
  'background-color',
  'background-image',
  'opacity',
  'transform',
  'transition',
  'width',
  'height',
  'border-radius',
  'box-shadow'
] as const;

const PSEUDOS = ['before', 'after'] as const;

/** What an element takes from its parent unless it says its own: what differs on every element of a page alike. */
const INHERITED = new Set<string>([
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'text-transform',
  'color'
]);

/** The version of what is read: a kept reading of the other page made before it changed is read again. */
const READING = 2;

export interface Measured {
  /** Where it was found: the selector the name resolved to. */
  selector: string;
  tag: string;
  /** Its first words, to tell it is the one meant. */
  text: string;
  /** Each property read — `before:background-image` for a pseudo-element's. */
  styles: Record<string, string>;
  /** The properties it holds as its parent does: inherited, not its own. */
  inherited: string[];
}

export interface MeasureOptions {
  url?: string;
  width?: number[];
  scheme?: Scheme;
  timezone?: string;
  /** Another page — another site's, a reference — whose element is measured beside this one. */
  compare?: string;
  /** That page's element, by any selector: the element's own name when left out. One element asked only. */
  there?: string;
  /**
   * The properties that must be the same as the other page's — `font-size,border` — or the command fails: what an
   * acceptance proves a value by, measured, never typed from a guess (velada-polish's VS sizes were the lead's guess).
   */
  same?: string[];
  /** The other page read again, never from what was kept of it. */
  fresh?: boolean;
  json?: boolean;
}

/** One element asked: ours, and the other page's — `ours => theirs`, or the same name there. */
interface Pair {
  here: string;
  there: string;
}

/** `fight-card-vs => .vs-medal`: ours, then the other page's; one name alone is both. */
export const pairOf = (asked: string): Pair => {
  const arrow = asked.indexOf('=>');
  const here = (arrow < 0 ? asked : asked.slice(0, arrow)).trim();
  const there = arrow < 0 ? '' : asked.slice(arrow + 2).trim();

  return { here, there: there === '' ? here : there };
};

/** One element of an open page, measured — or why it could not be. */
export const measureOn = async (page: BrowserPage, target: string): Promise<Measured | { problem: string }> => {
  const found = await targetOn(page, target);
  if ('problem' in found) {
    return found;
  }

  if (!found.found) {
    return {
      problem: `No element ${target} on ${page.url()} — name it by its element's id (fight-card-vs), #its-id, or any selector (.vs-medal, [data-plitzi-el="…"] > span)`
    };
  }

  return {
    selector: found.selector,
    ...(await page
      .locator(found.selector)
      .first()
      .evaluate(
        (
          node,
          {
            properties,
            pseudos,
            pseudoProperties,
            inheritable
          }: {
            properties: readonly string[];
            pseudos: readonly string[];
            pseudoProperties: readonly string[];
            inheritable: readonly string[];
          }
        ) => {
          const computed = getComputedStyle(node);
          const parent = node.parentElement ? getComputedStyle(node.parentElement) : undefined;
          const styles: Record<string, string> = Object.fromEntries(
            properties.map(property => [property, computed.getPropertyValue(property)])
          );
          for (const pseudo of pseudos) {
            const drawn = getComputedStyle(node, `::${pseudo}`);
            const content = drawn.getPropertyValue('content');
            if (content !== 'none' && content !== 'normal' && content !== '') {
              for (const property of pseudoProperties) {
                styles[`${pseudo}:${property}`] = drawn.getPropertyValue(property);
              }
            }
          }

          return {
            tag: node.tagName.toLowerCase(),
            text: node.textContent.replace(/\s+/g, ' ').trim().slice(0, 60),
            styles,
            inherited: parent
              ? inheritable.filter(
                  property => computed.getPropertyValue(property) === parent.getPropertyValue(property)
                )
              : []
          };
        },
        {
          properties: [...MEASURED],
          pseudos: [...PSEUDOS],
          pseudoProperties: [...PSEUDO_MEASURED],
          inheritable: [...INHERITED]
        }
      ))
  };
};

/** A colour written as CSS Color 4 writes it — `color(srgb 0.78 0.66 0.42 / 0.5)` — as `rgb()`: one colour, one way. */
const SRGB = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/g;

const channel = (value: string): string => String(Math.round(Number(value) * 255));

/** `oklab(L a b / alpha)` — what Tailwind writes a colour as — the same colour in sRGB channels (Björn Ottosson's). */
const OKLAB = /oklab\(([-\d.]+) ([-\d.]+) ([-\d.]+)(?: \/ ([\d.]+))?\)/g;

const fromOklab = (lightness: number, a: number, b: number): [number, number, number] => {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const gamma = (linear: number): number =>
    Math.round(
      Math.min(1, Math.max(0, linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055)) * 255
    );

  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  ];
};

const rgbText = ([r, g, b]: [number, number, number], alpha?: string): string =>
  alpha === undefined || Number(alpha) === 1
    ? `rgb(${String(r)}, ${String(g)}, ${String(b)})`
    : `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${String(Math.round(Number(alpha) * 100) / 100)})`;

/**
 * A computed value as it is compared: its colours in one notation, its numbers to two decimals — what a browser writes
 * two ways for one look (velada's gold read `rgb(199, 168, 107)` on one page and `color(srgb 0.78 0.66 0.42)` on the
 * other) is no difference to ask a developer for.
 */
const comparable = (property: string, value: string): string => {
  // Read held still — reduced motion, as a page is measured — a transition lasts nothing: no difference to ask for.
  if (
    property.endsWith('transition') &&
    /^(?:[^,]*?\b(?:0s|1e-0\d+s|0\.0+\d*s)\b[^,]*)(?:,[^,]*?\b(?:0s|1e-0\d+s|0\.0+\d*s)\b[^,]*)*$/.test(value)
  ) {
    return HELD_STILL;
  }

  const colours = value
    .replace(SRGB, (_match, r: string, g: string, b: string, alpha?: string) =>
      rgbText([Number(channel(r)), Number(channel(g)), Number(channel(b))], alpha)
    )
    .replace(OKLAB, (_match, lightness: string, a: string, b: string, alpha?: string) =>
      rgbText(fromOklab(Number(lightness), Number(a), Number(b)), alpha)
    )
    .replace(/rgba\((\d+), (\d+), (\d+), 1\)/g, 'rgb($1, $2, $3)');
  const numbers = colours.replace(/(\d+\.\d+)/g, number => String(Math.round(Number(number) * 100) / 100));
  // A font is the one it asks for first: the fallbacks after it are what a machine without it shows.
  if (property === 'font-family') {
    return (numbers.split(',')[0] ?? '').replace(/["']/g, '').trim().toLowerCase();
  }

  // A side with no width draws nothing, whatever its style and colour (its colour follows the text's).
  if (property.startsWith('border-') && /^0px\b/.test(numbers)) {
    return 'none';
  }

  return numbers;
};

/** A transition read on a page held still: alike to any, since what it would be is not read here. */
const HELD_STILL = 'held still';

/** The properties read on either side, in the order they are said: the box's, then its pseudo-elements'. */
const propertiesOf = (here: Measured, there: Measured): string[] => [
  ...MEASURED,
  ...[...new Set([...Object.keys(here.styles), ...Object.keys(there.styles)])]
    .filter(property => property.includes(':'))
    .sort()
];

export interface Difference {
  property: string;
  here: string;
  there: string;
  /** Inherited on both sides: what differs on every element under the same parent, said once and apart. */
  inherited?: true;
}

/** The properties that differ — here, there — and those the two share: what is read first, and what is said in a line. */
export const differences = (here: Measured, there: Measured): { differ: Difference[]; same: string[] } => {
  const value = (side: Measured, property: string): string => side.styles[property] ?? 'none';
  const alike = (property: string): boolean => {
    const [ours, theirs] = [comparable(property, value(here, property)), comparable(property, value(there, property))];

    return ours === theirs || ours === HELD_STILL || theirs === HELD_STILL;
  };
  const properties = propertiesOf(here, there);

  return {
    differ: properties
      .filter(property => !alike(property))
      .map(property => ({
        property,
        here: value(here, property),
        there: value(there, property),
        ...(here.inherited.includes(property) && there.inherited.includes(property) ? { inherited: true as const } : {})
      })),
    same: properties.filter(alike)
  };
};

const named = (each: Measured): string => `${each.tag}${each.text ? ` "${each.text}"` : ''} (${each.selector})`;

export const measuredText = (here: Measured, there?: Measured, url?: string): string => {
  if (!there) {
    return [
      chalk.bold(named(here)),
      ...Object.entries(here.styles).map(
        ([property, value]) =>
          `  ${property.padEnd(22)} ${value}${here.inherited.includes(property) ? chalk.dim('  (inherited)') : ''}`
      )
    ].join('\n');
  }

  const { differ, same } = differences(here, there);
  const own = differ.filter(each => !each.inherited);
  const inherited = differ.filter(each => each.inherited);

  return [
    chalk.bold(`${named(here)} here → ${named(there)} on ${url ?? 'the other page'}`),
    ...(differ.length === 0 ? ['  every property measured is the same'] : []),
    ...own.map(each => `  ${chalk.yellow('≠')} ${each.property.padEnd(22)} ${each.here}  →  ${each.there}`),
    // What the page's type gives every element: said once, so what this element itself does differently is read first.
    ...(inherited.length > 0
      ? [
          chalk.dim(
            `  ≈ inherited from its parent on both pages, differs: ${inherited.map(each => `${each.property} ${comparable(each.property, each.here)} → ${comparable(each.property, each.there)}`).join('; ')}`
          )
        ]
      : []),
    ...(same.length > 0 ? [chalk.dim(`  the same: ${same.join(', ')}`)] : [])
  ].join('\n');
};

/** Shorthands `--same` takes for the properties they stand for: a border is its four sides, a type its six. */
const GROUPS: Record<string, readonly string[]> = {
  border: ['border-top', 'border-right', 'border-bottom', 'border-left'],
  font: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform'],
  size: ['width', 'height']
};

const PSEUDO_PROPERTY = new RegExp(`^(${PSEUDOS.join('|')}):(${PSEUDO_MEASURED.join('|')})$`);

/**
 * `--same`'s list, each a property measured, a pseudo-element's (`before:background-image`) or a shorthand of them —
 * refused, naming the rest, when one is none of these.
 */
export const sameProperties = (value: string): string[] => {
  const asked = value
    .split(',')
    .map(each => each.trim())
    .filter(Boolean);
  const unknown = asked.filter(
    each => !Object.hasOwn(GROUPS, each) && !MEASURED.some(property => property === each) && !PSEUDO_PROPERTY.test(each)
  );
  if (unknown.length > 0 || asked.length === 0) {
    throw new InvalidArgumentError(
      `--same takes what is measured — ${MEASURED.join(', ')} — a pseudo-element's (before:${PSEUDO_MEASURED.join(', before:')}; after: the same), or ${Object.keys(GROUPS).join(', ')}${unknown.length > 0 ? `: not ${unknown.join(', ')}` : ''}`
    );
  }

  return [...new Set(asked.flatMap(each => GROUPS[each] ?? [each]))];
};

/** How long a reading of another site is kept: a reference does not change within a run. */
const KEPT_MS = 6 * 60 * 60_000;

/** What is kept of the other page, by what was asked of it: the page, the view, the element. */
interface Kept {
  at: string;
  measured: Measured;
}

const isKept = (value: unknown): value is Kept =>
  typeof value === 'object' &&
  value !== null &&
  typeof Reflect.get(value, 'at') === 'string' &&
  typeof Reflect.get(value, 'measured') === 'object';

const keptFile = (root: string, key: Record<string, unknown>): string =>
  path.join(
    root,
    PROJECT_TMP,
    'plitzi-cache',
    'measure',
    `${createHash('sha256')
      .update(JSON.stringify({ ...key, reading: READING }))
      .digest('hex')
      .slice(0, 32)}.json`
  );

const readKept = async (file: string, now: number): Promise<Kept | undefined> => {
  const read: unknown = await fs
    .readFile(file, 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);

  return isKept(read) && now - Date.parse(read.at) < KEPT_MS ? read : undefined;
};

/** One element asked, at one width: ours, the other page's — and how old the other reading is, when it was kept. */
export interface Reading {
  width: number;
  pair: Pair;
  here: Measured | { problem: string };
  there?: Measured | { problem: string };
  /** When the other page's reading was taken, when it was kept from an earlier call. */
  keptAt?: string;
  unlike: Difference[];
}

/** Our page at a width: open, its fonts in and the space hydrated — what a visitor's browser reads it as. */
const ourPage = async (browser: Browser, origin: string, route: string, view: ViewAsked): Promise<BrowserPage> => {
  const page = await openProjectPage(browser, origin, {
    width: view.width,
    height: 900,
    reducedMotion: true,
    ...(view.scheme ? { scheme: view.scheme } : {}),
    ...(view.timezone ? { timezone: view.timezone } : {})
  });
  await openPage(page, `${origin}${route}`);
  // A text the browser rewrites after hydration (a visitor's time, read in its zone) read before it was the server's:
  // velada-fidelity's hero read "19:00H CEST" once, "11:00H GMT-6" after. A page with no space root has no wait.
  await page.waitForSelector('[data-hydrated]', { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined), undefined);

  return page;
};

interface ViewAsked {
  width: number;
  scheme?: Scheme;
  timezone?: string;
}

/** Every pair, at one width: ours on one page, the others' kept or read on one page of the other site. */
const readAt = async (
  browser: Browser,
  root: string,
  where: { origin: string; route: string; target?: string },
  pairs: readonly Pair[],
  view: ViewAsked,
  options: Pick<MeasureOptions, 'same' | 'fresh'>,
  now: number
): Promise<Reading[]> => {
  const page = await ourPage(browser, where.origin, where.route, view);
  const ours = await Promise.all(pairs.map(pair => measureOn(page, pair.here)));
  await page.close();

  const { target } = where;
  const keys = pairs.map(pair =>
    keptFile(root, { url: target, width: view.width, scheme: view.scheme, timezone: view.timezone, there: pair.there })
  );
  const kept = target && !options.fresh ? await Promise.all(keys.map(file => readKept(file, now))) : [];
  const theirs: (Measured | { problem: string } | undefined)[] = pairs.map((_pair, index) => kept[index]?.measured);
  const missing = target === undefined ? [] : pairs.flatMap((_pair, index) => (theirs[index] ? [] : [index]));
  if (target !== undefined && missing.length > 0) {
    const other = await pageAnswered(browser, target, {
      width: view.width,
      height: 900,
      reducedMotion: true,
      ...(view.scheme ? { scheme: view.scheme } : {}),
      ...(view.timezone ? { timezone: view.timezone } : {})
    });
    for (const index of missing) {
      const read = 'problem' in other ? other : await measureOn(other.page, pairs[index].there);
      theirs[index] = read;
      if (!('problem' in read)) {
        await fs.mkdir(path.dirname(keys[index]), { recursive: true });
        await fs.writeFile(keys[index], JSON.stringify({ at: new Date(now).toISOString(), measured: read }));
      }
    }

    if (!('problem' in other)) {
      await other.page.close();
    }
  }

  return pairs.map((pair, index) => {
    const here = ours[index];
    const there = theirs[index];
    const unlike =
      there && !('problem' in there) && !('problem' in here) && options.same
        ? differences(here, there).differ.filter(each => options.same?.includes(each.property))
        : [];
    const keptAt = kept[index]?.at;

    return {
      width: view.width,
      pair,
      here,
      ...(there ? { there } : {}),
      ...(keptAt ? { keptAt } : {}),
      unlike
    };
  });
};

const minutesAgo = (at: string, now: number): string =>
  `${String(Math.max(0, Math.round((now - Date.parse(at)) / 60_000)))} min ago`;

/** What one reading says: its element measured, or why not — and, held to `--same`, whether it holds. */
export const readingText = (reading: Reading, target: string | undefined, same: string[] | undefined, now: number) => {
  const { here, there } = reading;
  if ('problem' in here) {
    return chalk.red(`✗ ${here.problem}`);
  }

  if (there && 'problem' in there) {
    return chalk.red(`✗ there: ${there.problem}`);
  }

  return [
    measuredText(here, there, target),
    ...(reading.keptAt
      ? [chalk.dim(`  (there: read ${minutesAgo(reading.keptAt, now)} and kept — --fresh reads it again)`)]
      : []),
    ...(same
      ? [
          reading.unlike.length > 0
            ? chalk.red(
                `✗ --same: ${reading.unlike.map(each => `${each.property} ${each.here} → ${each.there}`).join('; ')}`
              )
            : chalk.green(`✓ --same: ${same.join(', ')} as the other page's`)
        ]
      : [])
  ].join('\n');
};

export const measure = async (route: string, elements: string[], options: MeasureOptions): Promise<void> => {
  const project = await projectHere('whose page to measure');
  if (!project) {
    return;
  }

  const pairs = elements.map(pairOf);
  if (options.there !== undefined) {
    if (pairs.length !== 1) {
      fail('--there names the other page’s element of one element asked: for several, write each as "ours => theirs"');

      return;
    }

    pairs[0] = { here: pairs[0].here, there: options.there };
  }

  const target = options.compare
    ? new URL(options.compare).pathname === '/'
      ? new URL(route, options.compare).href
      : options.compare
    : undefined;
  if (options.same && !target) {
    fail('--same holds properties to another page: give it --compare <that page>');

    return;
  }

  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  // In a task's copy nobody serves, the copy served — as `page shot` serves it — never a second server beside one.
  const where = await originHere(project.root, plitzi, options.url);
  if ('problem' in where) {
    fail(where.problem);

    return;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    fail(browser.problem);

    return;
  }

  const now = Date.now();
  try {
    const readings: Reading[] = [];
    for (const width of options.width ?? [1440]) {
      readings.push(
        ...(await readAt(
          browser,
          project.root,
          { origin: where.origin, route, ...(target ? { target } : {}) },
          pairs,
          {
            width,
            ...(options.scheme ? { scheme: options.scheme } : {}),
            ...(options.timezone ? { timezone: options.timezone } : {})
          },
          options,
          now
        ))
      );
    }

    const failed = readings.some(
      reading => 'problem' in reading.here || (reading.there && 'problem' in reading.there) || reading.unlike.length > 0
    );
    const widths = options.width ?? [1440];
    console.log(
      options.json
        ? JSON.stringify({
            url: target,
            readings: readings.map(reading => ({
              ...reading,
              ...(reading.there && !('problem' in reading.there) && !('problem' in reading.here)
                ? differences(reading.here, reading.there)
                : {})
            })),
            ...(options.same ? { same: options.same } : {})
          })
        : widths
            .flatMap(width => [
              ...(widths.length > 1 ? [chalk.bold.underline(`At ${String(width)} px`)] : []),
              ...readings
                .filter(reading => reading.width === width)
                .map(reading => readingText(reading, target, options.same, now))
            ])
            .join('\n')
    );
    if (failed) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    where.stop?.();
  }
};
