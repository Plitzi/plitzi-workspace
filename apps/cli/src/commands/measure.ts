import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';
import { InvalidArgumentError } from 'commander';

import { openPage } from '@plitzi/sdk-authoring';
import { SPACE_FAILURE_META } from '@plitzi/sdk-shared/devTools';
import { PROJECT_TMP } from '@plitzi/sdk-shared/project';

import { launchBrowser, openProjectPage, PROJECT_QUIET_MS } from '../browser';
import { accountAsked, signInAs } from './check';
import { projectHere } from './existingProject';
import { measureOn } from './measureOn';
import { putIn, rowsOf, settle, stateText } from './measureState';
import { comparedText, keptText, readingText } from './measureText';
import { differences, MEASURED, onlyOf, PSEUDO_MEASURED, PSEUDOS, SIDE_LONGHANDS } from './measureValues';
import { fail, unanswered, UNANSWERED_EXIT } from './terminal';
import { applyConditions } from '../browser/conditions';
import { keptMeasure } from '../browser/keptBrowser';
import { conditionsOf } from './register/options';
import { originHere } from '../runs/copyServer';
import { pageAnswered } from './shot/remote';
import { actStep } from './shot/steps';
import { parseSteps } from './shotSteps';

import type { Account } from './check';
import type { StateAsked } from './measureState';
import type { Difference, Measured } from './measureValues';
import type { Browser, BrowserPage, Scheme } from '../browser';
import type { ActingStep } from './shot/steps';
import type { BrowserConditions } from '../browser/conditions';
import type { ConditionOptions } from './register/options';

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

export interface MeasureOptions extends ConditionOptions {
  url?: string;
  /** Signed in first as this account: the password from `PLITZI_CHECK_PASSWORD`. */
  as?: string;
  width?: number[];
  scheme?: Scheme;
  timezone?: string;
  /** Another page — another site's, a reference — whose element is measured beside this one. */
  compare?: string;
  /** That page's element, by any selector: the element's own name when left out. One element asked only. */
  there?: string;
  /**
   * The properties that must be the same as the other page's — `font-size,border` — or the command fails: what an
   * acceptance proves a value by, measured, never typed from a guess (a run's VS sizes were the lead's guess).
   */
  same?: string[];
  /** The other page read again, never from what was kept of it. */
  fresh?: boolean;
  /**
   * An element hovered, or focused, on both pages before the rest is measured — `fight-card => .fight-card`: what a
   * state changes, held by `--same` as the rest is (a run's medal fade could only be read by hand).
   */
  hover?: string;
  focus?: string;
  /**
   * Elements clicked on both pages, in order, before the rest is measured — `menu-toggle => .menu-button`: an open
   * state, a drawer and a panel in it (a run's designer measured the original's filter drawer by a script of its own).
   */
  click?: string[];
  /** Each row a list draws of every element asked, measured apart — never with --compare, whose rows are another's. */
  rows?: boolean;
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

const PSEUDO_PROPERTY = new RegExp(`^(${PSEUDOS.join('|')}):(${PSEUDO_MEASURED.join('|')})$`);

/**
 * `--same`'s list, each a property measured, a pseudo-element's (`before:background-image`) or a shorthand of them —
 * refused, naming the rest, when one is none of these.
 */
const measuredProperties =
  (flag: string) =>
  (value: string): string[] => {
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
        `${flag} takes what is measured — ${MEASURED.join(', ')}, a side of margin or padding (margin-bottom) — a pseudo-element's (before:${PSEUDO_MEASURED.join(', before:')}; after: the same), or ${Object.keys(GROUPS).join(', ')}${unknown.length > 0 ? `: not ${unknown.join(', ')}` : ''}`
      );
    }

    return [...new Set(asked.flatMap(each => GROUPS[each] ?? [each]))];
  };

/** `--same`'s list: what must be as the other page's. */
export const sameProperties = measuredProperties('--same');

/** `--only`'s list: what is printed of each element — a fit asks for its box, not thirty properties. */
export const onlyProperties = measuredProperties('--only');

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
/** Why the page is the server's own rather than the space's — the space does not author — or nothing. */
export const spaceFailureOn = async (page: BrowserPage): Promise<string | undefined> =>
  page
    .evaluate(meta => {
      if (!document.querySelector(`meta[name="${meta}"]`)) {
        return undefined;
      }

      const said = (document.querySelector('pre')?.textContent ?? '').trim().split('\n')[0] ?? '';

      return `the space does not author, so the page is the server's error page${said ? ` — ${said}` : ''}: npm run author says why`;
    }, SPACE_FAILURE_META)
    .catch(() => undefined);

export const ourPage = async (
  browser: Browser,
  origin: string,
  route: string,
  view: ViewAsked
): Promise<{ page: BrowserPage; answered: boolean; problem?: string }> => {
  const page = await openProjectPage(browser, origin, {
    width: view.width,
    height: 900,
    reducedMotion: true,
    ...(view.scheme ? { scheme: view.scheme } : {}),
    ...(view.timezone ? { timezone: view.timezone } : {})
  });
  if (view.conditions) {
    await applyConditions(page, view.conditions);
  }

  // Signed in first when asked (`--as`): a page for signed-in visitors read as one of them — a run's designers could
  // not look at a vote, a host's controls or a settings form, only `page check|shot` signing in.
  const refused = view.account && (await signInAs(page, origin, view.account));
  if (refused) {
    return { page, answered: false, problem: `--as ${refused}` };
  }

  const answered = (await openPage(page, `${origin}${route}`, { quietMs: PROJECT_QUIET_MS })) !== null;
  if (!answered) {
    return { page, answered };
  }

  // The server's own page while the space does not author: said, never "No element …" of every element asked.
  const failed = await spaceFailureOn(page);
  if (failed !== undefined) {
    return { page, answered: false, problem: failed };
  }

  // A text the browser rewrites after hydration (a visitor's time, read in its zone) read before it was the server's:
  // A run's hero read "19:00H CEST" once, "11:00H GMT-6" after. A page with no space root has no wait.
  await page.waitForSelector('[data-hydrated]', { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready.then(() => undefined), undefined);

  return { page, answered };
};

export interface ViewAsked {
  width: number;
  /** The account the page is read signed in as (`--as`). */
  account?: Account;
  scheme?: Scheme;
  timezone?: string;
  state?: StateAsked;
  /**
   * Played on this page before it is measured — `--steps`, as `page play` takes them: data only a visitor's steps make
   * (a run's chat line, which no demo data holds) measured where it is drawn.
   */
  steps?: readonly ActingStep[];
  /** The browser it is read in, where not a visitor's ordinary one (`--clock`, `--block`, `--autoplay`, `--storage`). */
  conditions?: BrowserConditions;
}

/** The other page's elements read on a page of their own, opened for them and closed: the way with no kept browser. */
const readOther = async (
  browser: Browser,
  target: string,
  view: ViewAsked,
  targets: readonly string[]
): Promise<(Measured | { problem: string })[]> => {
  const other = await pageAnswered(browser, target, {
    width: view.width,
    height: 900,
    reducedMotion: true,
    ...(view.scheme ? { scheme: view.scheme } : {}),
    ...(view.timezone ? { timezone: view.timezone } : {})
  });
  if ('problem' in other) {
    return targets.map(() => other);
  }

  const notPut = view.state ? await putIn(other.page, view.state, 'there') : undefined;
  const read: (Measured | { problem: string })[] = [];
  for (const there of targets) {
    read.push(notPut ?? (await measureOn(other.page, there)));
  }

  await other.page.close();

  return read;
};

/** The steps played on the page, each settled — or the one that could not be, said. */
const playedOn = async (page: BrowserPage, steps: readonly ActingStep[]): Promise<{ problem: string } | undefined> => {
  for (const [index, step] of steps.entries()) {
    const problem = await actStep(page, step, index);
    if (problem) {
      return problem;
    }

    await settle(page);
  }

  return undefined;
};

/** Every pair, at one width: ours on one page, the others' kept or read on one page of the other site. */
const readAt = async (
  browser: Browser,
  root: string,
  where: { origin: string; route: string; target?: string },
  pairs: readonly Pair[],
  view: ViewAsked,
  options: Pick<MeasureOptions, 'same' | 'fresh' | 'rows'>,
  now: number
): Promise<Reading[]> => {
  const { page, answered, problem } = await ourPage(browser, where.origin, where.route, view);
  // Nothing answering is said as such — not "No element … on chrome-error://" of a server gone (a run's lead).
  const notPut = !answered
    ? {
        problem:
          problem ??
          `nothing answers at ${where.origin}${where.route} — the server measured is not running (start it, or say where with --url)`
      }
    : ((await playedOn(page, view.steps ?? [])) ?? (view.state ? await putIn(page, view.state, 'here') : undefined));
  // Each row a list draws of an element, with --rows: the first alone hid that three plates' readouts differed.
  const asked = options.rows && !notPut ? (await Promise.all(pairs.map(pair => rowsOf(page, pair)))).flat() : pairs;
  const ours = notPut ? asked.map(() => notPut) : await Promise.all(asked.map(pair => measureOn(page, pair.here)));
  await page.close();

  const { target } = where;
  const keys = asked.map(pair =>
    keptFile(root, {
      url: target,
      width: view.width,
      scheme: view.scheme,
      timezone: view.timezone,
      there: pair.there,
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
            height: 900,
            ...(view.scheme ? { scheme: view.scheme } : {}),
            targets: missing.map(index => asked[index].there),
            ...(options.fresh ? { fresh: true } : {}),
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
            missing.map(index => asked[index].there)
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
      pair,
      here,
      ...(there ? { there } : {}),
      ...(keptAt ? { keptAt } : {}),
      unlike,
      ...(inheritedOnly.length > 0 ? { inherited: inheritedOnly } : {})
    };
  });
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
  if (options.hover !== undefined && options.focus !== undefined) {
    fail('One hovered or one focused at a time: --hover or --focus — after --click … when it is inside what they open');

    return;
  }

  const last: StateAsked['then'] =
    options.hover !== undefined
      ? { kind: 'hover', pair: pairOf(options.hover) }
      : options.focus !== undefined
        ? { kind: 'focus', pair: pairOf(options.focus) }
        : undefined;
  const state: StateAsked | undefined =
    options.click !== undefined
      ? { kind: 'click', pairs: options.click.map(pairOf), ...(last ? { then: last } : {}) }
      : last
        ? { kind: last.kind, pairs: [last.pair] }
        : undefined;

  const target = options.compare
    ? new URL(options.compare).pathname === '/'
      ? new URL(route, options.compare).href
      : options.compare
    : undefined;
  if (options.rows && target) {
    fail(
      '--rows measures this page’s rows of a list: the other page’s are another list — measure them without --compare'
    );

    return;
  }

  if (options.same && !target) {
    fail('--same holds properties to another page: give it --compare <that page>');

    return;
  }

  const parsed = options.steps === undefined ? [] : parseSteps(options.steps, 500);
  if ('problem' in parsed) {
    fail(`--steps: ${parsed.problem}.`);

    return;
  }

  // What this page's visitor does before it is measured: the other page is another site, with no such data to make.
  if (parsed.length > 0 && target) {
    fail(
      '--steps makes data on this page before it is measured: leave out --compare, or put the other page in its state with --click'
    );

    return;
  }

  const pictured = parsed.find(step => step.kind === 'shot' || step.kind === 'frames');
  if (pictured) {
    fail(`page measure reads what the steps leave, with no picture: "${pictured.kind}" is page shot --steps'.`);

    return;
  }

  const steps = parsed.filter((step): step is ActingStep => step.kind !== 'shot' && step.kind !== 'frames');

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

  const account = await accountAsked(project.root, options.as);
  if (account === null) {
    await browser.close();

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
            ...(account ? { account } : {}),
            ...(options.scheme ? { scheme: options.scheme } : {}),
            ...(options.timezone ? { timezone: options.timezone } : {}),
            ...(state ? { state } : {}),
            ...(steps.length > 0 ? { steps } : {}),
            conditions: conditionsOf(options)
          },
          options,
          now
        ))
      );
    }

    // Only what was asked of each, with --only: its box for a fit, never thirty properties to grep.
    const shownReadings = readings.map(reading => ({
      ...reading,
      here: onlyOf(reading.here, options.only),
      ...(reading.there ? { there: onlyOf(reading.there, options.only) } : {})
    }));
    const failed = readings.some(
      reading => 'problem' in reading.here || (reading.there && 'problem' in reading.there) || reading.unlike.length > 0
    );
    const widths = options.width ?? [1440];
    const kept = target ? keptText(readings, now) : undefined;
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
                    `Read with ${stateText(state, 'here')}${target ? ` (there: ${stateText(state, 'there')})` : ''}, its transitions finished`
                  )
                ]
              : []),
            ...(target ? [comparedText(target)] : []),
            ...(kept ? [kept] : []),
            ...widths.flatMap(width => [
              ...(widths.length > 1 ? [chalk.bold.underline(`At ${String(width)} px`)] : []),
              ...shownReadings
                .filter(reading => reading.width === width)
                .map(reading =>
                  readingText(
                    reading,
                    options.same,
                    now,
                    kept !== undefined,
                    options.all === true || options.only !== undefined
                  )
                )
            ])
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
