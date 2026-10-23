import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';
import { InvalidArgumentError } from 'commander';

import { openPage } from '@plitzi/sdk-authoring';
import { PROJECT_TMP } from '@plitzi/sdk-shared/project';

import { launchBrowser, openProjectPage, PROJECT_QUIET_MS } from '../browser';
import { projectHere } from './existingProject';
import {
  comparable,
  differences,
  INHERITED,
  MEASURED,
  PSEUDO_MEASURED,
  PSEUDOS,
  SIDE_LONGHANDS
} from './measureValues';
import { originHere } from '../runs/copyServer';
import { targetOn } from './shot/capture';
import { pageAnswered } from './shot/remote';
import { fail, unanswered, UNANSWERED_EXIT } from './terminal';

import type { Difference, Measured } from './measureValues';
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

/** The version of what is read: a kept reading of the other page made before it changed is read again. */
const READING = 3;

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
  /**
   * An element hovered, or focused, on both pages before the rest is measured — `fight-card => .fight-card`: what a
   * state changes, held by `--same` as the rest is (velada-backlog's medal fade could only be read by hand).
   */
  hover?: string;
  focus?: string;
  json?: boolean;
}

/** The state both pages are measured in: an element of each hovered or focused first. */
export interface StateAsked {
  kind: 'hover' | 'focus';
  pair: Pair;
}

/** The longest a state's transitions are waited for: a fade is a fraction of a second, an endless spin never ends. */
const SETTLE_MS = 3000;

/** Puts the page in the state asked — the element hovered or focused — and waits for what it starts to finish. */
export const putIn = async (
  page: BrowserPage,
  state: StateAsked,
  target: string
): Promise<{ problem: string } | undefined> => {
  const found = await targetOn(page, target);
  if ('problem' in found) {
    return found;
  }

  if (!found.found) {
    return { problem: `No element ${target} to ${state.kind} on ${page.url()}` };
  }

  const element = page.locator(found.selector).first();
  try {
    await (state.kind === 'hover' ? element.hover({ timeout: 5000 }) : element.focus({ timeout: 5000 }));
  } catch (error) {
    return {
      problem: `${target} could not be ${state.kind === 'hover' ? 'hovered' : 'focused'} on ${page.url()}: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`
    };
  }
  await page.evaluate(
    (most: number) =>
      Promise.race([
        Promise.all(
          document
            .getAnimations()
            .filter(animation => animation.effect?.getTiming().iterations !== Infinity)
            .map(animation => animation.finished.catch(() => undefined))
        ),
        new Promise(resolve => setTimeout(resolve, most))
      ]).then(() => undefined),
    SETTLE_MS
  );

  return undefined;
};

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

/**
 * What to write instead of a name not on the page: the same name the other way — an element's id written as a class
 * (`.home-faq-answer-text`, velada-backlog's design-1), a class as an id — when that way finds it; how to name one else.
 */
const otherSpelling = async (page: BrowserPage, target: string): Promise<string> => {
  const name = /^[.#]?([A-Za-z_][\w-]*)$/.exec(target)?.[1];
  const ways = name === undefined ? [] : [name, `.${name}`].filter(way => way !== target);
  for (const way of ways) {
    const other = await targetOn(page, way);
    if (!('problem' in other) && other.found) {
      return way === name
        ? `${name} is an element's id here: write it without the dot`
        : `${name} is a class here, no element's id: write it .${name}`;
    }
  }

  return `name it by its element's id (fight-card-vs), #its-id, or any selector (.vs-medal, [data-plitzi-el="…"] > span)`;
};

/** How long a picture measured is waited for before it is read as it is: a picture that never loads holds nothing. */
const IMAGE_WAIT_MS = 5000;

/** How many matches of a selector are looked through for the first one shown. */
const SHOWN_LOOK = 20;

/**
 * The first match of `selector` a visitor sees, as a selector: itself when it is the first, `… >> nth=N` when an
 * earlier one is hidden, and itself again when none is shown (measured as it is, hidden or not).
 */
const firstShown = async (page: BrowserPage, selector: string): Promise<string> => {
  for (let index = 0; index < SHOWN_LOOK; index += 1) {
    const nth = `${selector} >> nth=${String(index)}`;
    const match = page.locator(nth).first();
    if ((await match.count()) === 0) {
      break;
    }

    if (await match.isVisible()) {
      return index === 0 ? selector : nth;
    }
  }

  return selector;
};

/** One element of an open page, measured — or why it could not be. */
export const measureOn = async (page: BrowserPage, target: string): Promise<Measured | { problem: string }> => {
  const found = await targetOn(page, target);
  if ('problem' in found) {
    return found;
  }

  if (!found.found) {
    return { problem: `No element ${target} on ${page.url()} — ${await otherSpelling(page, target)}` };
  }

  // Of several matches, the first a visitor sees: the original's first `.header__heading-logo` is its hidden menu
  // drawer's, and whichever the page drew first was measured — 0 px one call, 140 px the next (lx-copy's finish).
  const shown = await firstShown(page, found.selector);
  if (shown !== found.selector) {
    found.selector = shown;
  }

  // A picture is measured drawn: read before it loads, an <img> sized by its own picture is 0 px wide, or "auto" tall
  // (lx-copy: the original's logo read 140 px one call and 0 px the next, and failed the finish). A lazy one is asked
  // for now; one that never loads is measured as it is after IMAGE_WAIT_MS.
  await page
    .locator(found.selector)
    .first()
    .evaluate(async (node, waitMs: number) => {
      if (!(node instanceof HTMLImageElement) || (node.complete && node.naturalWidth > 0)) {
        return;
      }

      node.loading = 'eager';
      await Promise.race([node.decode().catch(() => undefined), new Promise(resolve => setTimeout(resolve, waitMs))]);
    }, IMAGE_WAIT_MS)
    .catch(() => undefined);

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
          styles.x = `${String(Math.round(node.getBoundingClientRect().left))}px`;
          // The transform that applies: `translate`, `rotate` and `scale` — what Tailwind 4 writes `rotate-45` as — then
          // `transform`, as CSS composes them. Read alone, the original's diamond was "transform: none" beside ours.
          const [moved, turned, sized] = ['translate', 'rotate', 'scale'].map(property =>
            computed.getPropertyValue(property)
          );
          if ([moved, turned, sized].some(value => value !== '' && value !== 'none')) {
            const box = node.getBoundingClientRect();
            const length = (value: string, of: number): number =>
              value.endsWith('%') ? (Number.parseFloat(value) / 100) * of : Number.parseFloat(value) || 0;
            const degrees = (value: string): number =>
              value.endsWith('rad')
                ? (Number.parseFloat(value) * 180) / Math.PI
                : value.endsWith('turn')
                  ? Number.parseFloat(value) * 360
                  : Number.parseFloat(value) || 0;
            let matrix = new DOMMatrix();
            if (moved && moved !== 'none') {
              const [x = '0', y = '0', z = '0'] = moved.split(' ');
              matrix = matrix.translate(length(x, box.width), length(y, box.height), length(z, 0));
            }

            if (turned && turned !== 'none') {
              const words = turned.split(' ');
              const angle = degrees(words[words.length - 1] ?? '0');
              const [axis] = words;
              matrix =
                words.length === 1 || axis === 'z'
                  ? matrix.rotate(0, 0, angle)
                  : axis === 'x'
                    ? matrix.rotate(angle, 0, 0)
                    : axis === 'y'
                      ? matrix.rotate(0, angle, 0)
                      : matrix.rotateAxisAngle(
                          Number.parseFloat(words[0] ?? '0'),
                          Number.parseFloat(words[1] ?? '0'),
                          Number.parseFloat(words[2] ?? '1'),
                          angle
                        );
            }

            if (sized && sized !== 'none') {
              const [sx = 1, sy = sx, sz = 1] = sized
                .split(' ')
                .map(value => (value.endsWith('%') ? Number.parseFloat(value) / 100 : Number.parseFloat(value)));
              matrix = matrix.scale(sx, sy, sz);
            }

            const own = styles.transform;
            styles.transform = (own && own !== 'none' ? matrix.multiply(new DOMMatrix(own)) : matrix).toString();
          }

          for (const pseudo of pseudos) {
            const drawn = getComputedStyle(node, `::${pseudo}`);
            const content = drawn.getPropertyValue('content');
            if (content !== 'none' && content !== 'normal' && content !== '') {
              for (const property of pseudoProperties) {
                styles[`${pseudo}:${property}`] = drawn.getPropertyValue(property);
              }
            }
          }

          const tag = node.tagName.toLowerCase();
          const root = tag === 'body' || tag === 'html' ? document.querySelector('[data-plitzi-el]') : null;

          return {
            tag,
            ...(root ? { spaceRoot: root.getAttribute('data-plitzi-el') ?? '' } : {}),
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

const named = (each: Measured): string => `${each.tag}${each.text ? ` "${each.text}"` : ''} (${each.selector})`;

/** What a line and a tracking are of their font: the rule that writes them, where pixels say one size's result. */
const EM_RELATIVE = new Set(['line-height', 'letter-spacing']);

/**
 * A line height or a tracking as a share of the element's own font size — `22.13px` is `1.5em` of 14.75px: the value to
 * write once for every size, where a developer copying the pixels tried three (velada-shell's VS text).
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

export const measuredText = (here: Measured, there?: Measured, url?: string): string => {
  if (!there) {
    return [
      chalk.bold(named(here)),
      ...rootNote(here),
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
    ...rootNote(here),
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
    each =>
      !Object.hasOwn(GROUPS, each) &&
      !Object.hasOwn(SIDE_LONGHANDS, each) &&
      !MEASURED.some(property => property === each) &&
      !PSEUDO_PROPERTY.test(each)
  );
  if (unknown.length > 0 || asked.length === 0) {
    throw new InvalidArgumentError(
      `--same takes what is measured — ${MEASURED.join(', ')}, a side of margin or padding (margin-bottom) — a pseudo-element's (before:${PSEUDO_MEASURED.join(', before:')}; after: the same), or ${Object.keys(GROUPS).join(', ')}${unknown.length > 0 ? `: not ${unknown.join(', ')}` : ''}`
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
  /** Of `--same`'s, what differs only as both inherit it from their parent: said, not failed — the parent holds it. */
  inherited?: Difference[];
}

/** Our page at a width: open, its fonts in and the space hydrated — what a visitor's browser reads it as. */
const ourPage = async (
  browser: Browser,
  origin: string,
  route: string,
  view: ViewAsked
): Promise<{ page: BrowserPage; answered: boolean }> => {
  const page = await openProjectPage(browser, origin, {
    width: view.width,
    height: 900,
    reducedMotion: true,
    ...(view.scheme ? { scheme: view.scheme } : {}),
    ...(view.timezone ? { timezone: view.timezone } : {})
  });
  const answered = (await openPage(page, `${origin}${route}`, { quietMs: PROJECT_QUIET_MS })) !== null;
  if (!answered) {
    return { page, answered };
  }

  // A text the browser rewrites after hydration (a visitor's time, read in its zone) read before it was the server's:
  // velada-fidelity's hero read "19:00H CEST" once, "11:00H GMT-6" after. A page with no space root has no wait.
  await page.waitForSelector('[data-hydrated]', { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined), undefined);

  return { page, answered };
};

interface ViewAsked {
  width: number;
  scheme?: Scheme;
  timezone?: string;
  state?: StateAsked;
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
  const { page, answered } = await ourPage(browser, where.origin, where.route, view);
  // Nothing answering is said as such — not "No element … on chrome-error://" of a server gone (velada-shell's lead).
  const notPut = !answered
    ? {
        problem: `nothing answers at ${where.origin}${where.route} — the server measured is not running (start it, or say where with --url)`
      }
    : view.state
      ? await putIn(page, view.state, view.state.pair.here)
      : undefined;
  const ours = notPut ? pairs.map(() => notPut) : await Promise.all(pairs.map(pair => measureOn(page, pair.here)));
  await page.close();

  const { target } = where;
  const keys = pairs.map(pair =>
    keptFile(root, {
      url: target,
      width: view.width,
      scheme: view.scheme,
      timezone: view.timezone,
      there: pair.there,
      ...(view.state ? { state: view.state.kind, of: view.state.pair.there } : {})
    })
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
    const otherNotPut =
      view.state && !('problem' in other) ? await putIn(other.page, view.state, view.state.pair.there) : undefined;
    for (const index of missing) {
      const read = 'problem' in other ? other : (otherNotPut ?? (await measureOn(other.page, pairs[index].there)));
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
    const asked =
      there && !('problem' in there) && !('problem' in here) && options.same
        ? differences(here, there, options.same).differ.filter(each => options.same?.includes(each.property))
        : [];
    // What both inherit from their parent is the parent's to hold, not the element's: said beside the line, never
    // failing it — a proof line failed on a font-size the task never touched (velada-shell's design-1).
    const unlike = asked.filter(each => !each.inherited);
    const inheritedOnly = asked.filter(each => each.inherited);
    const keptAt = kept[index]?.at;

    return {
      width: view.width,
      pair,
      here,
      ...(there ? { there } : {}),
      ...(keptAt ? { keptAt } : {}),
      unlike,
      ...(inheritedOnly.length > 0 ? { inherited: inheritedOnly } : {})
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
            : chalk.green(`✓ --same: ${same.join(', ')} as the other page's`),
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

  if (options.hover !== undefined && options.focus !== undefined) {
    fail('One state at a time: --hover or --focus');

    return;
  }

  const asked = options.hover ?? options.focus;
  const state: StateAsked | undefined =
    asked === undefined ? undefined : { kind: options.hover !== undefined ? 'hover' : 'focus', pair: pairOf(asked) };

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
    unanswered(where.problem);

    return;
  }

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    unanswered(browser.problem);

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
            ...(options.timezone ? { timezone: options.timezone } : {}),
            ...(state ? { state } : {})
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
            ...(state ? { state: { [state.kind]: state.pair } } : {}),
            readings: readings.map(reading => ({
              ...reading,
              ...(reading.there && !('problem' in reading.there) && !('problem' in reading.here)
                ? differences(reading.here, reading.there)
                : {})
            })),
            ...(options.same ? { same: options.same } : {})
          })
        : [
            ...(state
              ? [
                  chalk.dim(
                    `Read with ${state.pair.here} ${state.kind === 'hover' ? 'hovered' : 'focused'}${target ? ` (there: ${state.pair.there})` : ''}, its transitions finished`
                  )
                ]
              : []),
            ...widths.flatMap(width => [
              ...(widths.length > 1 ? [chalk.bold.underline(`At ${String(width)} px`)] : []),
              ...readings
                .filter(reading => reading.width === width)
                .map(reading => readingText(reading, target, options.same, now))
            ])
          ].join('\n')
    );
    // The other page's element not there is the question's, not this page's: unanswered (lx-copy's logo line read the
    // original's hidden copy, and every try of the task failed for it).
    if (readings.some(reading => reading.there !== undefined && 'problem' in reading.there)) {
      process.exitCode = UNANSWERED_EXIT;
    } else if (failed) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    where.stop?.();
  }
};
