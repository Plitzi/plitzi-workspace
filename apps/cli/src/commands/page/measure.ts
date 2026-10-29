import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';
import { InvalidArgumentError } from 'commander';

import { PROJECT_TMP } from '@plitzi/sdk-shared/project';

import { measureOn } from './measureOn';
import { putIn, copiesOf, stateText } from './measureState';
import { comparedText, keptText, matchesNote, readingText, WHOLE_SAID } from './measureText';
import { asksExtra, differences, extraOf, MEASURED, onlyOf, PSEUDO_MEASURED, PSEUDOS } from './measureValues';
import { otherPageAt, pageAnswered } from './shot/remote';
import { actingSteps, playedOn } from './shot/steps';
import { visitorsOn } from './shot/visitors';
import { noPageNote, openVisit, visitorBrowser, visitViewOf, zoneNote } from './visit';
import { VIEW_HEIGHT } from '../../browser';
import { keptMeasure } from '../../browser/keptBrowser';
import { originHere } from '../../runs/copies/copyServer';
import { authoredHandles } from '../../runs/plan/expectations';
import { projectHere } from '../project/existingProject';
import { fail, unanswered, UNANSWERED_EXIT } from '../shared/terminal';

import type { StateAsked } from './measureState';
import type { Difference, Measured, MeasuredExtra } from './measureValues';
import type { Browser, BrowserPage, Scheme } from '../../browser';
import type { VisitorOptions } from '../register/options';
import type { ActingStep } from './shot/steps';
import type { Visitor, VisitView } from './visit';

/**
 * `plitzi page measure`: an element's computed styles — what a designer sizes a copy by — and, with `--compare`, the
 * same of an element of another page, beside them. A run's designers wrote Playwright scripts of their own and
 * read the original's CSS by curl for each value they asked a developer for (a size, a weight, a tracking, a border);
 * the comparison of pictures says what differs, never by how much.
 *
 * Its calls are an agent's loop, multiplied: a run's developers made ~150 of them at ~18 s each, one element
 * at one width a call, the original loaded whole — and pictured — every time. So one call measures every element asked
 * at every width asked, in one browser; the other page is read without a picture, and what was read of it is kept (it
 * does not change within a run) for the calls after.
 */

/**
 * The version of how a reading is made: a kept reading of the other page made before it changed is read again. What it
 * reads — `MEASURED`, `PSEUDO_MEASURED` — is in the key itself: a run added `list-style` and `y`, and a reading kept
 * before them answered "none" for both, each a difference that was not there.
 */
const READING = 3;

export interface MeasureOptions extends VisitorOptions {
  width?: number[];
  /** Each scheme measured, as --width each width: a picker's two schemes took two calls. */
  scheme?: Scheme[];
  /** Another page — another site's, a reference — whose element is measured beside this one. */
  compare?: string;
  /** That page's element, by any selector: the element's own name when left out. One element asked only. */
  there?: string;
  /**
   * The properties that must be the same as the other page's — `font-size,border` — or the command fails: what an
   * acceptance proves a value by, measured, never typed from a guess (a run's VS sizes were the lead's guess).
   */
  same?: string[];
  /**
   * A property each element measured must hold, as the browser computes it — `transform=matrix(1, 0, 0, 1, 0, 3)` — or
   * the command fails: an acceptance line holding one page's value (a key latched) piped `--json` into `node -e`.
   */
  expect?: Expected[];
  /**
   * An element hovered, or focused, on both pages before the rest is measured — `fight-card => .fight-card`: what a
   * state changes, held by `--same` as the rest is (a run's medal fade could only be read by hand).
   */
  hover?: string;
  focus?: string;
  /** An element held down on both pages — the mouse pressed and kept — as `:active` draws it. */
  press?: string;
  /**
   * Elements clicked on both pages, in order, before the rest is measured — `menu-toggle => .menu-button`: an open
   * state, a drawer and a panel in it (a run's designer measured the original's filter drawer by a script of its own).
   */
  click?: string[];
  /** Every copy the page draws of each element asked, measured apart — never with --compare, whose copies are another's. */
  each?: boolean;
  /**
   * Read as a visitor who asked for no less motion: what an animation is. Held still by default, a page's own
   * reduced-motion rules read "animation 1e-05s" for a needle that rides the music.
   */
  motion?: boolean;
  /** Every property read, its initial and inherited ones too — a reading alone leaves them out (`measureText.ts`). */
  all?: boolean;
  /** Played before it is measured, as `page play --steps` writes them. */
  steps?: string;
  /** Only these properties of each element, printed: `box`, `font`, `border`, `size` or any measured. */
  only?: string[];
  json?: boolean;
}

/** One element asked: ours, and the other page's — `ours => theirs`, or the same name there. */
export interface Pair {
  here: string;
  there: string;
}

/** `pricing-card => .plan-card`: ours, then the other page's; one name alone is both. */
export const pairOf = (asked: string): Pair => {
  const arrow = asked.indexOf('=>');
  const here = (arrow < 0 ? asked : asked.slice(0, arrow)).trim();
  const there = arrow < 0 ? '' : asked.slice(arrow + 2).trim();

  return { here, there: there === '' ? here : there };
};

/** Shorthands `--same` takes for the properties they stand for: a border is its four sides, a type its six. */
const GROUPS: Record<string, readonly string[]> = {
  border: ['border-top', 'border-right', 'border-bottom', 'border-left'],
  font: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform'],
  size: ['width', 'height'],
  // Where it is and how big, its spacing with it: what a fit is checked by — a run's agents grepped it out of 30.
  box: ['x', 'y', 'width', 'height', 'padding', 'margin']
};

/** A CSS property's name, as `getComputedStyle` takes it: `overflow-x`, `-webkit-line-clamp`, a pseudo's `after:margin-left`. */
const PROPERTY_NAME = new RegExp(`^(?:(?:${PSEUDOS.join('|')}):)?-?[a-z][a-z0-9-]*$`);

/**
 * `--same`'s and `--only`'s list: each a property always measured, a pseudo-element's (`before:background-image`), a
 * shorthand of them — or any other CSS property by its name, read as well (`overflow-x`, `after:scroll-snap-align`):
 * whether the browser knows it is asked of the browser, once, before anything is read (`unknownProperties`).
 */
const measuredProperties =
  (flag: string) =>
  (value: string): string[] => {
    const asked = value
      .split(',')
      .map(each => each.trim())
      .filter(Boolean);
    const unknown = asked.filter(each => !Object.hasOwn(GROUPS, each) && !PROPERTY_NAME.test(each));
    if (unknown.length > 0 || asked.length === 0) {
      throw new InvalidArgumentError(
        `${flag} takes CSS properties by name, comma-separated — any the browser knows (overflow-x, scroll-snap-type), a pseudo-element's as before:<property> or after:<property> — or ${Object.keys(GROUPS).join(', ')}${unknown.length > 0 ? `: not ${unknown.join(', ')}` : ''}`
      );
    }

    return [...new Set(asked.flatMap(each => GROUPS[each] ?? [each]))];
  };

/** One `--expect`: a property, and the value it must compute to. */
export interface Expected {
  property: string;
  value: string;
}

/** `--expect property=value`, each its own flag: a value holds commas (`matrix(1, 0, 0, 1, 0, 3)`), never a list. */
export const expectedOf = (value: string, previous: Expected[] = []): Expected[] => {
  const at = value.indexOf('=');
  const property = at === -1 ? '' : value.slice(0, at).trim();
  if (property === '' || !PROPERTY_NAME.test(property)) {
    throw new InvalidArgumentError(
      'takes a CSS property and the value it must compute to — transform=none, after:content="•" — one a flag'
    );
  }

  return [...previous, { property, value: value.slice(at + 1).trim() }];
};

/** A computed value as compared: its spaces as one, so `matrix(1,0,…)` and `matrix(1, 0, …)` read alike. */
const valueText = (value: string): string =>
  value
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

/** Each element read whose property is not the value expected: a line each, said where the command fails. */
export const expectationsMissed = (readings: readonly Reading[], expected: readonly Expected[]): string[] =>
  readings.flatMap(({ here, pair, width, scheme }) => {
    if ('problem' in here) {
      return [];
    }

    return expected.flatMap(({ property, value }) => {
      const actual = Object.hasOwn(here.styles, property) ? here.styles[property] : undefined;

      return actual !== undefined && valueText(actual) === valueText(value)
        ? []
        : [
            `--expect ${property}=${value}: ${pair.here} at ${String(width)} px${scheme ? ` ${scheme}` : ''} ${actual === undefined ? 'has none read' : `is ${actual}`}`
          ];
    });
  });

/** What a measure reads besides what always is: the properties `--only`, `--same` and `--expect` name beyond those. */
const extraAsked = (options: Pick<MeasureOptions, 'only' | 'same' | 'expect'>): MeasuredExtra =>
  extraOf([...(options.only ?? []), ...(options.same ?? []), ...(options.expect ?? []).map(each => each.property)]);

/** The properties asked by name that the browser knows no property by: `--only glow`, refused before anything is read. */
const unknownProperties = async (browser: Browser, extra: MeasuredExtra): Promise<string[]> => {
  const page = await browser.newPage({
    viewport: { width: 400, height: 300 },
    colorScheme: 'light',
    reducedMotion: 'reduce'
  });
  try {
    return await page.evaluate(
      names => names.filter(name => !CSS.supports(name, 'inherit')),
      [...new Set([...extra.properties, ...extra.pseudo])]
    );
  } finally {
    await page.close();
  }
};

/** `--same`'s list: what must be as the other page's. */
export const sameProperties = measuredProperties('--same');

/** `--only`'s list: what is printed of each element — a fit asks for its box, not thirty properties. */
export const onlyProperties = measuredProperties('--only');

/** Past this many elements in one measure, with nothing named of them, each is said by its box alone. */
const BOXES_PAST = 3;

/**
 * Whether a measure says each element by its box alone: many read at once, and nothing named of them — no property, no
 * comparison, no expectation, no `--json` (which holds every one).
 */
export const readsBoxesOnly = (
  elements: number,
  options: {
    only?: readonly string[];
    all?: boolean;
    same?: readonly string[];
    expect?: readonly unknown[];
    json?: boolean;
  }
): boolean =>
  elements > BOXES_PAST &&
  options.only === undefined &&
  options.all !== true &&
  options.same === undefined &&
  options.expect === undefined &&
  options.json !== true;

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

/** What a kept reading is found by: what was asked of the other page, and how and what it was read with. */
export const readingKey = (key: Record<string, unknown>): string =>
  JSON.stringify({ ...key, reading: READING, measured: MEASURED, pseudo: PSEUDO_MEASURED });

const keptFile = (root: string, key: Record<string, unknown>): string =>
  path.join(
    root,
    PROJECT_TMP,
    'plitzi-cache',
    'measure',
    `${createHash('sha256').update(readingKey(key)).digest('hex').slice(0, 32)}.json`
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
  /** The scheme it was read in, when one was asked. */
  scheme?: Scheme;
  pair: Pair;
  here: Measured | { problem: string };
  there?: Measured | { problem: string };
  /** When the other page's reading was taken, when it was kept from an earlier call. */
  keptAt?: string;
  unlike: Difference[];
  /** Of `--same`'s, what differs only as both inherit it from their parent: said, not failed — the parent holds it. */
  inherited?: Difference[];
}

/** The visitor of a view, without what is put on the page after it opens. */
const visitOf = ({ state: _state, steps: _steps, ...visit }: ViewAsked): VisitView & Visitor => visit;

/** A page of ours as `page measure` reads it: the visitor (`visit.ts`), and what is put on it before it is read. */
export interface ViewAsked extends VisitView, Visitor {
  state?: StateAsked;
  /**
   * Played on this page before it is measured — `--steps`, as `page play` takes them: data only a visitor's steps make
   * (a run's chat line, which no demo data holds) measured where it is drawn.
   */
  steps?: readonly ActingStep[];
}

/** The other page's elements read on a page of their own, opened for them and closed: the way with no kept browser. */
const readOther = async (
  browser: Browser,
  target: string,
  view: ViewAsked,
  targets: readonly string[],
  extra: MeasuredExtra
): Promise<(Measured | { problem: string })[]> => {
  const other = await pageAnswered(browser, target, {
    width: view.width,
    height: view.height ?? VIEW_HEIGHT,
    reducedMotion: view.reducedMotion ?? true,
    ...(view.scheme ? { scheme: view.scheme } : {}),
    ...(view.timezone ? { timezone: view.timezone } : {}),
    ...(view.conditions ? { conditions: view.conditions } : {})
  });
  if ('problem' in other) {
    return targets.map(() => other);
  }

  const notPut = view.state ? await putIn(other.page, view.state, 'there') : undefined;
  const read: (Measured | { problem: string })[] = [];
  for (const there of targets) {
    read.push(notPut ?? (await measureOn(other.page, there, { extra })));
  }

  await other.page.close();

  return read;
};

/** How long a page resized is given to lay itself out again before it is read. */
const RESIZE_SETTLE_MS = 300;

/** Every pair, at one width: ours on one page, the others' kept or read on one page of the other site. */
const readAt = async (
  browser: Browser,
  root: string,
  where: { origin: string; route: string; target?: string },
  pairs: readonly Pair[],
  view: ViewAsked,
  options: Pick<MeasureOptions, 'same' | 'only' | 'fresh' | 'each'>,
  now: number,
  /** Whether the space authors an id with no box of its own (`boxless`): a provider, drawn as its children. */
  boxless?: (id: string) => Promise<boolean>,
  /**
   * The page its steps were played on at the width before, read again at this one — its window resized, the steps not
   * played twice: an action a step took (a report, a dismissal) was refused at the second width, and the measure stopped.
   */
  played?: { page?: BrowserPage; keep: (page: BrowserPage) => void }
): Promise<Reading[]> => {
  const extra = extraAsked(options);
  const reused = played?.page;
  if (reused) {
    await reused.setViewportSize({ width: view.width, height: view.height ?? VIEW_HEIGHT });
    await reused.waitForTimeout(RESIZE_SETTLE_MS);
  }

  const { page, answered, problem } = reused
    ? { page: reused, answered: true, problem: undefined }
    : await openVisit(browser, where.origin, where.route, visitOf(view));
  // Another account's steps (`as dax: action room-create {…}`) set up a state the cold copy lacks before it is measured:
  // A run's tester could not measure an empty room some other visitor made.
  const visitors = visitorsOn(root, browser, where.origin, {
    width: view.width,
    ...(view.scheme ? { scheme: view.scheme } : {}),
    ...(view.timezone ? { timezone: view.timezone } : {})
  });
  // Nothing answering is said as such — not "No element … on chrome-error://" of a server gone (a run's lead).
  const notPut = !answered
    ? {
        problem:
          problem ??
          `nothing answers at ${where.origin}${where.route} — the server measured is not running (start it, or say where with --url)`
      }
    : reused
      ? await visitors.close().then(() => undefined)
      : ((await playedOn(page, view.steps ?? [], visitors).finally(() => visitors.close())) ??
        (view.state ? await putIn(page, view.state, 'here') : undefined));
  // Every copy the page draws of an element, with --each: the first alone hid that three plates' readouts differed.
  const asked = options.each && !notPut ? (await Promise.all(pairs.map(pair => copiesOf(page, pair)))).flat() : pairs;
  const ours = notPut
    ? asked.map(() => notPut)
    : await Promise.all(asked.map(pair => measureOn(page, pair.here, { ...(boxless ? { boxless } : {}), extra })));
  if (played && !notPut) {
    played.keep(page);
  } else {
    await page.close();
  }

  const { target } = where;
  const keys = asked.map(pair =>
    keptFile(root, {
      url: target,
      width: view.width,
      scheme: view.scheme,
      timezone: view.timezone,
      ...(view.reducedMotion === false ? { motion: true } : {}),
      there: pair.there,
      ...(asksExtra(extra) ? { extra } : {}),
      ...(view.state
        ? {
            state: `${view.state.kind}${view.state.then ? `>${view.state.then.kind}` : ''}`,
            of: [...view.state.pairs, ...(view.state.then ? [view.state.then.pair] : [])]
              .map(pair => pair.there)
              .join(' > ')
          }
        : {})
    })
  );
  const kept = target && !options.fresh ? await Promise.all(keys.map(file => readKept(file, now))) : [];
  const theirs: (Measured | { problem: string } | undefined)[] = asked.map((_pair, index) => kept[index]?.measured);
  const missing = target === undefined ? [] : pairs.flatMap((_pair, index) => (theirs[index] ? [] : [index]));
  if (target !== undefined && missing.length > 0) {
    // Read in the kept browser, its pages loaded between calls — one in a state on a page no other reader shares, loaded
    // ahead. A time zone is its context's: read here.
    const keptReadings =
      view.timezone === undefined
        ? await keptMeasure(root, {
            url: target,
            width: view.width,
            height: view.height ?? VIEW_HEIGHT,
            ...(view.reducedMotion === false ? { reducedMotion: false } : {}),
            ...(view.scheme ? { scheme: view.scheme } : {}),
            targets: missing.map(index => asked[index].there),
            ...(options.fresh ? { fresh: true } : {}),
            ...(asksExtra(extra) ? { extra } : {}),
            ...(view.state && {
              state: {
                kind: view.state.kind,
                targets: view.state.pairs.map(pair => pair.there),
                ...(view.state.then ? { then: { kind: view.state.then.kind, target: view.state.then.pair.there } } : {})
              }
            })
          })
        : undefined;
    // Answered with readings, they are what was read; answered with a problem of its own — on its way out, too slow — or
    // not at all, the page is read here as before: a kept browser never fails a measure that would pass without it.
    const read: (Measured | { problem: string })[] =
      keptReadings && 'readings' in keptReadings
        ? keptReadings.readings
        : await readOther(
            browser,
            target,
            view,
            missing.map(index => asked[index].there),
            extra
          );
    for (const [at, index] of missing.entries()) {
      const each = read[at] ?? { problem: `${asked[index].there} was not read` };
      theirs[index] = each;
      if (!('problem' in each)) {
        await fs.mkdir(path.dirname(keys[index]), { recursive: true });
        await fs.writeFile(keys[index], JSON.stringify({ at: new Date(now).toISOString(), measured: each }));
      }
    }
  }

  return asked.map((pair, index) => {
    const here = ours[index];
    const there = theirs[index];
    const asked =
      there && !('problem' in there) && !('problem' in here) && options.same
        ? differences(here, there, options.same).differ.filter(each => options.same?.includes(each.property))
        : [];
    // What both inherit from their parent is the parent's to hold, not the element's: said beside the line, never
    // failing it — a proof line failed on a font-size the task never touched (a run's design-1).
    const unlike = asked.filter(each => !each.inherited);
    const inheritedOnly = asked.filter(each => each.inherited);
    const keptAt = kept[index]?.at;

    return {
      width: view.width,
      ...(view.scheme ? { scheme: view.scheme } : {}),
      pair,
      here,
      ...(there ? { there } : {}),
      ...(keptAt ? { keptAt } : {}),
      unlike,
      ...(inheritedOnly.length > 0 ? { inherited: inheritedOnly } : {})
    };
  });
};

/**
 * Each reading's problems as said once: why an element is not drawn on a page — the ways it may not be, a paragraph —
 * whole for the first, and pointed back to for each after it.
 */
export const saidOnce = (readings: readonly Reading[]): Reading[] => {
  const said = new Set<string>();
  const once = <T>(read: T | { problem: string }): T | { problem: string } => {
    if (typeof read !== 'object' || read === null || !('problem' in read)) {
      return read;
    }

    const at = read.problem.indexOf(' — ');
    const why = at < 0 ? undefined : read.problem.slice(at + 3);
    if (why === undefined || !said.has(why)) {
      if (why !== undefined) {
        said.add(why);
      }

      return read;
    }

    return { problem: `${read.problem.slice(0, at)} — not drawn here either (why, above)` };
  };

  return readings.map(reading => ({
    ...reading,
    here: once(reading.here),
    ...(reading.there ? { there: once(reading.there) } : {})
  }));
};

/**
 * Lines said once each, with how many times they came: a step that failed is the same failure for every element read
 * after it — a run's designer read one failed action four times a width.
 */
export const onceEach = (lines: readonly string[]): string[] => {
  const counts = new Map<string, number>();
  lines.forEach(line => counts.set(line, (counts.get(line) ?? 0) + 1));

  return [...counts].map(([line, count]) => (count > 1 ? `${line} (×${String(count)})` : line));
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

  // Clicks first, in order, then one element hovered or focused: a menu opened and an item of it hovered. A hover
  // and a focus at once are no state a visitor reaches.
  if ([options.hover, options.focus, options.press].filter(each => each !== undefined).length > 1) {
    fail(
      'One hovered, focused or held down at a time: --hover, --focus or --press — after --click … when it is inside what they open'
    );

    return;
  }

  const last: StateAsked['then'] =
    options.hover !== undefined
      ? { kind: 'hover', pair: pairOf(options.hover) }
      : options.focus !== undefined
        ? { kind: 'focus', pair: pairOf(options.focus) }
        : options.press !== undefined
          ? { kind: 'press', pair: pairOf(options.press) }
          : undefined;
  const state: StateAsked | undefined =
    options.click !== undefined
      ? { kind: 'click', pairs: options.click.map(pairOf), ...(last ? { then: last } : {}) }
      : last
        ? { kind: last.kind, pairs: [last.pair] }
        : undefined;

  const target = options.compare === undefined ? undefined : otherPageAt(route, options.compare);
  if (options.each && target) {
    fail(
      '--each measures this page’s copies of an element: the other page’s are other copies — measure them without --compare'
    );

    return;
  }

  if (options.same && !target) {
    fail(
      `--same holds properties to another page: give it --compare <that page> — to print only some of this page's, --only ${options.same.join(',')}`
    );

    return;
  }

  const steps = actingSteps(options.steps, 'page measure');
  if ('problem' in steps) {
    fail(`${steps.problem}.`);

    return;
  }

  // What this page's visitor does before it is measured: the other page is another site, with no such data to make.
  if (steps.length > 0 && target) {
    fail(
      '--steps makes data on this page before it is measured: leave out --compare, or put the other page in its state with --click'
    );

    return;
  }

  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  // In a task's copy nobody serves, the copy served — as `page shot` serves it — never a second server beside one.
  const where = await originHere(project.root, plitzi, options.url);
  if ('problem' in where) {
    unanswered(where.problem);

    return;
  }

  const ready = await visitorBrowser(project.root, options);
  if (!ready) {
    return;
  }

  const { visitor, browser } = ready;

  const now = Date.now();
  // Authored only when an element is not found: what a measure that finds everything never pays for.
  let authored: ReturnType<typeof authoredHandles> | undefined;
  const boxless = async (id: string): Promise<boolean> => {
    authored ??= authoredHandles(project.root);
    const handles = await authored;

    return handles !== undefined && Object.hasOwn(handles.elements, id) && handles.elements[id].boxless === true;
  };
  try {
    const extra = extraAsked(options);
    const unknown = asksExtra(extra) ? await unknownProperties(browser, extra) : [];
    if (unknown.length > 0) {
      fail(
        `${unknown.join(', ')}: no CSS ${unknown.length === 1 ? 'property' : 'properties'} this browser knows — --only and --same take a property by the name CSS gives it (overflow-x, scroll-snap-align), a pseudo-element's as after:<property>`
      );

      return;
    }

    const readings: Reading[] = [];
    const views = (options.scheme ?? [undefined]).flatMap(scheme =>
      (options.width ?? [1440]).map(width => ({ width, scheme }))
    );
    // With steps, each scheme's page is played once and read at every width by resizing it: an action a step took is
    // taken once — a report made twice was refused, and the measure stopped at its second width.
    const playedPages = new Map<string, BrowserPage>();
    for (const { width, scheme } of views) {
      const kept = playedPages.get(scheme ?? '');
      const played =
        steps.length > 0
          ? {
              ...(kept ? { page: kept } : {}),
              keep: (page: BrowserPage) => {
                playedPages.set(scheme ?? '', page);
              }
            }
          : undefined;
      readings.push(
        ...(await readAt(
          browser,
          project.root,
          { origin: where.origin, route, ...(target ? { target } : {}) },
          pairs,
          {
            width,
            ...visitViewOf(options),
            ...(options.motion ? { reducedMotion: false } : {}),
            ...visitor,
            ...(scheme ? { scheme } : {}),
            ...(state ? { state } : {}),
            ...(steps.length > 0 ? { steps } : {})
          },
          options,
          now,
          boxless,
          played
        ))
      );
    }

    await Promise.all([...playedPages.values()].map(page => page.close()));

    // Only what was asked of each, with --only: its box for a fit, never thirty properties to grep. Why one is not drawn
    // said once: a run's tester measured sixteen copies of a part, eight there, and read the paragraph eight times.
    // Many elements read at once, nothing named of them: their boxes — a run's measure of ten parts answered 31k
    // characters, forty lines an element, where a layout's question is where each is and how big.
    const boxesOnly = readsBoxesOnly(pairs.length, options);
    const only = boxesOnly ? onlyProperties('box') : options.only;
    const shownReadings = saidOnce(readings).map(reading => ({
      ...reading,
      here: onlyOf(reading.here, only),
      ...(reading.there ? { there: onlyOf(reading.there, only) } : {})
    }));
    const missed = expectationsMissed(readings, options.expect ?? []);
    const failed =
      missed.length > 0 ||
      readings.some(
        reading =>
          'problem' in reading.here || (reading.there && 'problem' in reading.there) || reading.unlike.length > 0
      );
    const widths = options.width ?? [1440];
    const kept = target ? keptText(readings, now) : undefined;
    const noPage = await noPageNote(project.root, route);
    console.log(
      options.json
        ? JSON.stringify({
            url: target,
            ...(state
              ? {
                  state: {
                    [state.kind]: state.kind === 'click' ? state.pairs : state.pairs[0],
                    ...(state.then ? { [state.then.kind]: state.then.pair } : {})
                  }
                }
              : {}),
            readings: shownReadings.map(reading => ({
              ...reading,
              ...(!('problem' in reading.here) && reading.here.matches !== undefined
                ? { note: matchesNote(reading.here.matches) }
                : {}),
              ...(reading.there && !('problem' in reading.there) && !('problem' in reading.here)
                ? differences(reading.here, reading.there)
                : {})
            })),
            ...(options.same ? { same: options.same } : {}),
            ...(options.expect ? { expected: options.expect, missed } : {})
          })
        : [
            ...(state
              ? [
                  chalk.dim(
                    `Read with ${stateText(state, 'here')}${target ? ` (there: ${stateText(state, 'there')})` : ''}, its transitions finished`
                  )
                ]
              : []),
            ...(target ? [comparedText(target)] : []),
            ...(kept ? [kept] : []),
            chalk.dim(
              `Read at ${widths.map(width => `${String(width)}×${String(options.height ?? VIEW_HEIGHT)}`).join(', ')} — x from the viewport's left, y from the page's top`
            ),
            ...(boxesOnly
              ? [
                  chalk.dim(
                    `${String(pairs.length)} elements, each by its box — --only <properties>, or three at most, reads more of each`
                  )
                ]
              : options.only === undefined && options.same === undefined && target === undefined
                ? [chalk.dim(WHOLE_SAID)]
                : []),
            ...[
              zoneNote(options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone, new Date(now)),
              noPage
            ].flatMap(note => (note === undefined ? [] : [chalk.dim(note)])),
            ...views.flatMap(({ width, scheme }) => [
              ...(views.length > 1
                ? [chalk.bold.underline(`At ${String(width)} px${scheme ? `, ${scheme}` : ''}`)]
                : []),
              ...onceEach(
                shownReadings
                  .filter(reading => reading.width === width && reading.scheme === scheme)
                  .map(reading =>
                    readingText(
                      reading,
                      options.same,
                      now,
                      kept !== undefined,
                      options.all === true || only !== undefined
                    )
                  )
              )
            ]),
            ...(options.expect === undefined
              ? []
              : missed.length === 0
                ? [
                    chalk.green(
                      `✓ --expect ${options.expect.map(each => `${each.property}=${each.value}`).join(', ')}: every element read holds it`
                    )
                  ]
                : missed.map(line => chalk.red(`✗ ${line}`)))
          ].join('\n')
    );
    // The other page's element not there is the question's, not this page's: unanswered (a run's logo line read the
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
