import chalk from 'chalk';

import { launchBrowser } from '../browser';
import { accountAsked, projectAccount } from './check';
import { projectHere } from './existingProject';
import { ourPage, pairOf } from './measure';
import { settle } from './measureState';
import { readState } from './playState';
import { parseSteps } from './shotSteps';
import { keptSession } from '../browser/keptBrowser';
import { conditionsOf } from './register/options';
import { originHere } from '../runs/copyServer';
import { pageAnswered } from './shot/remote';
import { actStep, stepText } from './shot/steps';
import { visitorsOn } from './shot/visitors';
import { fail, unanswered, UNANSWERED_EXIT } from './terminal';

import type { BrowserPage, Scheme } from '../browser';
import type { Pair } from './measure';
import type { ElementState } from './playState';
import type { ConditionOptions } from './register/options';
import type { ActingStep } from './shot/steps';
import type { Visitors } from './shot/visitors';
import type { ShotStep } from './shotSteps';

/** How much of an element's text a line of `--read` shows; `--json` has it whole. */
const TEXT_SHOWN = 80;

/** The steps that act on a page — what may write on its server: a queue's share spent, a vote cast. */
const ACTING = new Set(['click', 'press', 'type', 'drag', 'as', 'action']);

/**
 * What a play over several widths says when its steps act: each width is played on one server, so the next starts from
 * what the first changed there — a run's crate queue gave its real answer at 1440 alone, 390 meeting the share spent.
 */
export const sharedServerNote = (widths: number, steps: readonly { kind: string }[]): string | undefined =>
  widths > 1 && steps.some(step => ACTING.has(step.kind))
    ? `Each width played on one server: what the first width’s steps changed there (a share spent, a vote cast) is what the next starts from${steps.some(step => step.kind === 'action') ? ' — its actions ran at the first width alone' : ''} — play each width alone, after plitzi server reset, to read each from a cold start.`
    : undefined;

/**
 * `plitzi page play`: an interaction played step by step — a press, a drag, a key — and, after each step, how far each
 * element read moved and how it stands (shown, enabled), on the project's page and, with `--compare`, on the other
 * site's at once; `--same` fails where the two do otherwise. What a control does, read as numbers and held by an
 * acceptance line: every run so far had its agents and its lead write browser scripts for it (two dozen,
 * a carousel's arrows used there and back on both sites).
 *
 * How far something moved is how far its content went: its scroll less its place — the same number for a row that
 * scrolls its box and one that slides its track by a transform, whichever way each site builds it.
 */

export interface PlayOptions extends ConditionOptions {
  steps?: string;
  timezone?: string;
  /** The elements read after each step, `"ours => theirs"` with `--compare`. */
  read?: string[];
  compare?: string;
  /** What must be as the other page's after every step: `moved`, `shown`, `enabled`. */
  same?: string[];
  width?: number[];
  scheme?: Scheme;
  url?: string;
  /** Signed in first as this account: the password from `PLITZI_CHECK_PASSWORD`. */
  as?: string;
  /** Read as a guest, though a page sends one away: the project's account is not signed in by itself. */
  guest?: boolean;
  json?: boolean;
}

/** What `--same` holds: how far it moved, whether it is shown, whether it takes a press. */
export const PLAY_SAME = ['moved', 'shown', 'enabled'] as const;

export type PlaySame = (typeof PLAY_SAME)[number];

export interface PlayedStep {
  /** `start` before any step, else the step as written. */
  step: string;
  /**
   * A side the step did nothing on — its control hidden or taking no press, as a visitor's press does nothing — and why:
   * said, never played as if it happened (a tab drawn per width, its press at 390 skipped without a word).
   */
  idle?: Partial<Record<keyof Pair, string>>;
  /** Where the step took the page, when it went elsewhere — a link followed, a form sent: a run's filter links. */
  went?: Partial<Record<keyof Pair, string>>;
  /** Its target was scrolled into view before it, as a pointer reaches it: what moved is measured from there. */
  reached?: true;
  /** What an action step answered — its output, clipped. */
  answer?: string;
  /** Each element read, by how it was asked, here and — with `--compare` — there. */
  reads: { element: string; here?: ElementState; there?: ElementState; moved?: Moved; problem?: string }[];
}

/** How far it moved since the step before, each side. */
interface Moved {
  here: { x: number; y: number };
  there?: { x: number; y: number };
}

/** Two moves the same, within a couple of pixels or 2% of the move — a layout rounding, never a different step. */
const alike = (a: number, b: number): boolean => Math.abs(a - b) <= Math.max(2, Math.abs(b) * 0.02);

/** A step as one side plays it: its element that side's, from `"ours => theirs"`. */
const sideOf = (step: ActingStep, side: keyof Pair): ActingStep =>
  'target' in step ? { ...step, target: pairOf(step.target)[side] } : step;

/** The steps, each played on each page, every element read after it — or what kept a step from happening. */
/**
 * One page a play is played on: a page of this command's, or the other site's held warm in the kept browser
 * (`keptSession`) — a step acted and waited for until the page is still, elements read as `readState` reads them.
 */
export interface PlaySide {
  /** What kept the step from happening — or an action's answer, said under its step. */
  act: (step: ActingStep, index: number) => Promise<{ problem: string } | { answer: string } | undefined>;
  /** Where its page is now, path and query: a step that takes it elsewhere is said (`PlayedStep.went`). */
  address?: () => string;
  read: (targets: readonly string[]) => Promise<(ElementState | { problem: string })[] | { problem: string }>;
}

/** A page of this command's as a side of a play — `visitors`, the other accounts its `as` steps play as. */
export const pageSide = (page: BrowserPage, visitors?: Visitors): PlaySide => ({
  address: () => {
    const url = new URL(page.url());

    return `${url.pathname}${url.search}`;
  },
  act: async (step, index) => {
    const done = await actStep(page, step, index, visitors);
    // What the step started, over: its animations ended and the page's layout still — a slide, a drawer, a scroll.
    if (!done || !('problem' in done)) {
      await settle(page);
    }

    return done;
  },
  read: async targets => {
    const states: (ElementState | { problem: string })[] = [];
    for (const target of targets) {
      states.push(await readState(page, target));
    }

    return states;
  }
});

/** The steps, each played on each side, every element read after it — or what kept a step from happening. */
export const playOn = async (
  sides: { here: PlaySide; there?: PlaySide },
  steps: readonly ActingStep[],
  reads: readonly Pair[],
  { actions = true }: { actions?: boolean } = {}
): Promise<{ played: PlayedStep[] } | { problem: string; side: keyof Pair }> => {
  const played: PlayedStep[] = [];
  let last: PlayedStep | undefined;
  const readSide = async (
    side: PlaySide,
    targets: readonly string[]
  ): Promise<(ElementState | { problem: string })[]> => {
    const read = await side.read(targets);

    return 'problem' in read ? targets.map(() => read) : read;
  };
  const readAll = async (label: string): Promise<PlayedStep> => {
    const entry: PlayedStep = { step: label, reads: [] };
    const heres = await readSide(
      sides.here,
      reads.map(pair => pair.here)
    );
    const theres = sides.there
      ? await readSide(
          sides.there,
          reads.map(pair => pair.there)
        )
      : [];
    for (const [index, pair] of reads.entries()) {
      const here = heres.at(index) ?? { problem: `${pair.here} was not read` };
      const there = sides.there ? (theres.at(index) ?? { problem: `${pair.there} was not read` }) : undefined;
      const problem =
        'problem' in here ? here.problem : there && 'problem' in there ? `there: ${there.problem}` : undefined;
      const before = last?.reads[index];
      const hereState = 'problem' in here ? undefined : here;
      const thereState = there && !('problem' in there) ? there : undefined;
      const moved =
        before?.here && hereState
          ? {
              here: { x: hereState.offset.x - before.here.offset.x, y: hereState.offset.y - before.here.offset.y },
              ...(before.there && thereState
                ? {
                    there: {
                      x: thereState.offset.x - before.there.offset.x,
                      y: thereState.offset.y - before.there.offset.y
                    }
                  }
                : {})
            }
          : undefined;
      entry.reads.push({
        element: sides.there ? `${pair.here} => ${pair.there}` : pair.here,
        ...(hereState ? { here: hereState } : {}),
        ...(thereState ? { there: thereState } : {}),
        ...(moved ? { moved } : {}),
        ...(problem ? { problem } : {})
      });
    }

    last = entry;

    return entry;
  };

  played.push(await readAll('start'));
  for (const [index, step] of steps.entries()) {
    const idle: Partial<Record<keyof Pair, string>> = {};
    const was = { here: sides.here.address?.(), there: sides.there?.address?.() };
    const names = sides.there ? (['here', 'there'] as const) : (['here'] as const);
    // A write to the server is made once: a run's designer created two rooms with one play at two widths.
    if (step.kind === 'action' && !actions) {
      idle.here = `${step.action} ran once, at the first width: what it did is on the server this width reads`;
    }

    const acting = (name: keyof Pair): { side: PlaySide; step: ActingStep } | undefined => {
      const side = name === 'here' ? sides.here : sides.there;

      return side && idle[name] === undefined ? { side, step: sideOf(step, name) } : undefined;
    };
    let reached = false;
    for (const name of names) {
      const at = acting(name);
      if (!at || !['click', 'drag', 'type', 'hover'].includes(at.step.kind) || !('target' in at.step)) {
        continue;
      }

      // A press on a control out of use — hidden, disabled, passing the pointer on — does nothing, as a visitor's does:
      // played as such, never a failure; what it left is read as after any step.
      const state = (await readSide(at.side, [at.step.target])).at(0);
      if (at.step.kind !== 'hover' && state && !('problem' in state) && (!state.shown || !state.enabled)) {
        idle[name] =
          `${at.step.target} ${state.shown ? 'takes no press' : 'is not shown'}: the ${at.step.kind} did nothing`;
        continue;
      }

      // Brought into view first, as the pointer would: the scroll it takes is the reach, never the step's — a run's
      // play said a sticky preview "moved 315px down" after a click on a switch out of view.
      if (state && !('problem' in state) && state.inView !== 'whole') {
        // One that cannot be reached is said by the step itself, which finds it the same way.
        await at.side.act({ kind: 'scroll', target: at.step.target }, index).catch(() => undefined);
        reached = true;
      }
    }

    // What it moves is read from where the reach left it.
    if (reached) {
      await readAll('reached');
    }

    let answer: string | undefined;
    for (const name of names) {
      const at = acting(name);
      if (!at) {
        continue;
      }

      try {
        const done = await at.side.act(at.step, index);
        if (done && 'problem' in done) {
          return { problem: done.problem, side: name };
        }

        answer = done?.answer ?? answer;
      } catch (error) {
        return {
          problem: `Step ${String(index + 1)} (${stepText(step)}) did not happen${name === 'there' ? ' there' : ''}: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`,
          side: name
        };
      }
    }

    const now = { here: sides.here.address?.(), there: sides.there?.address?.() };
    const went: Partial<Record<keyof Pair, string>> = {
      ...(now.here !== undefined && now.here !== was.here ? { here: now.here } : {}),
      ...(now.there !== undefined && now.there !== was.there ? { there: now.there } : {})
    };
    const entry = await readAll(stepText(step));
    played.push({
      ...entry,
      ...(Object.keys(idle).length > 0 ? { idle } : {}),
      ...(Object.keys(went).length > 0 ? { went } : {}),
      ...(reached ? { reached: true as const } : {}),
      ...(answer === undefined ? {} : { answer })
    });
  }

  return { played };
};

/** What differs from the other page under `--same`, by step and element. */
export const unlikeIn = (played: readonly PlayedStep[], same: readonly PlaySame[]): string[] =>
  played.flatMap(entry =>
    entry.reads.flatMap(read => {
      const { here, there, moved } = read;
      if (!here || !there) {
        return [];
      }

      return [
        ...(same.includes('moved') &&
        moved?.there &&
        !(alike(moved.here.x, moved.there.x) && alike(moved.here.y, moved.there.y))
          ? [`${entry.step}: ${read.element} moved ${moveText(moved.here)} here, ${moveText(moved.there)} there`]
          : []),
        ...(same.includes('shown') && here.shown !== there.shown
          ? [
              `${entry.step}: ${read.element} is ${here.shown ? 'shown' : 'hidden'} here, ${there.shown ? 'shown' : 'hidden'} there`
            ]
          : []),
        ...(same.includes('enabled') && here.enabled !== there.enabled
          ? [
              `${entry.step}: ${read.element} ${here.enabled ? 'takes a' : 'takes no'} press here, ${there.enabled ? 'takes a' : 'takes no'} press there`
            ]
          : [])
      ];
    })
  );

const moveText = ({ x, y }: { x: number; y: number }): string =>
  x === 0 && y === 0
    ? 'nothing'
    : [
        x === 0 ? '' : `${String(Math.abs(x))}px ${x > 0 ? 'left' : 'right'}`,
        y === 0 ? '' : `${String(Math.abs(y))}px ${y > 0 ? 'up' : 'down'}`
      ]
        .filter(Boolean)
        .join(', ');

const stateText = (state: ElementState): string =>
  [
    `${state.shown ? 'shown' : state.screenReaderOnly ? 'for screen readers only' : 'hidden'}, ${state.enabled ? 'enabled' : 'no press'}`,
    // Said when it is not plainly there: half out of the viewport, out of it, or under something drawn over it.
    ...(state.shown && state.inView !== 'whole' ? [state.inView === 'part' ? 'partly in view' : 'out of view'] : []),
    ...(state.shown && state.coveredBy ? [`under ${state.coveredBy}`] : []),
    ...(state.transform ? [state.transform] : []),
    ...(state.animations ? [state.animations.join(', ')] : []),
    ...(state.focused ? ['focused'] : []),
    ...Object.entries(state.aria).map(([name, value]) => `${name} ${value}`),
    ...(state.value !== undefined ? [`value "${state.value}"`] : []),
    ...(state.rows === undefined ? [] : [`${String(state.rows)} rows`]),
    ...(state.text
      ? [
          `"${state.text.length > TEXT_SHOWN ? `${state.text.slice(0, TEXT_SHOWN)}…" (--json has its ${String(state.text.length)} characters)` : `${state.text}"`}`
        ]
      : [])
  ].join(' · ');

/**
 * A played interaction in lines: each step, and each element as it left it — here, and there beside it. How far it
 * moved is said of an element some step moves; of one none does (a button), it would be noise on every line.
 */
export const playedText = (played: readonly PlayedStep[]): string[] => {
  const moves = (index: number): boolean =>
    played.some(entry => {
      const moved = entry.reads[index]?.moved;

      return (
        moved !== undefined &&
        [moved.here, moved.there].some(each => each !== undefined && (each.x !== 0 || each.y !== 0))
      );
    });

  /** An element as read at a step, its line whole: what it shows, how it moved, a colour the step changed. */
  const readLine = (at: number, index: number): string => {
    const read = played[at]?.reads.at(index);
    if (!read) {
      return '';
    }

    const said = moves(index) && read.moved !== undefined;
    // Its colour said when a step changed it — what a tone picked, a state lit — never on every line.
    const before = at === 0 ? undefined : played[at - 1]?.reads.at(index)?.here?.colour;
    const colour =
      read.here && before && (before.text !== read.here.colour.text || before.ground !== read.here.colour.ground)
        ? ` · colour now ${read.here.colour.text} on ${read.here.colour.ground} (was ${before.text} on ${before.ground})`
        : '';
    const here = `${said && read.moved ? `moved ${moveText(read.moved.here)}, ` : ''}${read.here ? stateText(read.here) : ''}${colour}`;
    const there = read.there
      ? chalk.dim(
          ` | there ${said && read.moved?.there ? `moved ${moveText(read.moved.there)}, ` : ''}${stateText(read.there)}`
        )
      : '';

    return `  ${read.element}: ${here}${there}`;
  };

  return played.flatMap((entry, at) => [
    chalk.bold(entry.step),
    ...(entry.reached
      ? [chalk.dim('  (scrolled into view first, as a pointer reaches it: moves are from there)')]
      : []),
    ...(entry.answer === undefined ? [] : [`  ← ${entry.answer}`]),
    ...(entry.went?.here ? [`  → ${entry.went.here}`] : []),
    ...(entry.went?.there ? [chalk.dim(`  → there ${entry.went.there}`)] : []),
    ...(entry.idle?.here ? [chalk.yellow(`  here: ${entry.idle.here}`)] : []),
    ...(entry.idle?.there ? [chalk.yellow(`  there: ${entry.idle.there}`)] : []),
    ...entry.reads.flatMap((read, index) => {
      if (read.problem) {
        const appears = played.some(later => later !== entry && later.reads.at(index)?.problem === undefined);
        // Never there: said once, at the first step — the same line at every step and width buried the steps that
        // were read (a run's `--read a,b`).
        const before = played.slice(0, played.indexOf(entry)).some(earlier => earlier.reads.at(index)?.problem);

        return appears
          ? [`  ${read.element}: ${chalk.dim('not on the page yet')}`]
          : before
            ? []
            : [`  ${read.element}: ${chalk.red(read.problem)} ${chalk.dim('(at every step)')}`];
      }

      const line = readLine(at, index);
      // Read again as it was: said so — a run's nine steps repeated two elements whole at each, 21k characters.
      const previous = at > 0 && played[at - 1]?.reads.at(index)?.problem === undefined ? readLine(at - 1, index) : '';

      return [line === previous ? `  ${read.element}: ${chalk.dim('as before')}` : line];
    })
  ]);
};

/**
 * What `--same` says of the steps: each difference, or that they held — never a pass while an element read is not on
 * the page, which holds nothing ("✓ every step as theirs" beside one not built yet).
 */
export const verdictOf = (
  same: readonly PlaySame[],
  unlike: readonly string[],
  missing: boolean,
  other: string
): string[] =>
  same.length === 0
    ? []
    : missing
      ? [chalk.red(`✗ --same ${same.join(',')}: an element read is not on the page — nothing is held until it is`)]
      : unlike.length === 0
        ? [chalk.green(`✓ --same ${same.join(',')}: every step as ${other}'s`)]
        : unlike.map(line => chalk.red(`✗ --same: ${line}`));

/** `--read a,b,c` as `--width 390,1440` takes them: a list of element ids, each read — a selector's comma is kept. */
export const readTargets = (read: readonly string[] = []): string[] =>
  read.flatMap(each => (/^[\w-]+(,[\w-]+)+$/.test(each) ? each.split(',') : [each]));

/** The steps asked — none with `--read` alone: the page as it rests, the start read and nothing played. */
export const stepsOf = (options: Pick<PlayOptions, 'steps' | 'read'>): ShotStep[] | { problem: string } => {
  if ((options.steps ?? '').trim() !== '') {
    const parsed = parseSteps(options.steps ?? '', 500);

    return 'problem' in parsed ? { problem: `--steps: ${parsed.problem}.` } : parsed;
  }

  return (options.read ?? []).length > 0
    ? []
    : { problem: 'page play needs --steps — or --read alone, to read the page as it rests.' };
};

export const play = async (route: string, options: PlayOptions): Promise<void> => {
  const project = await projectHere('whose page to play');
  if (!project) {
    return;
  }

  const parsed = stepsOf(options);
  if ('problem' in parsed) {
    fail(parsed.problem);

    return;
  }

  const pictured = parsed.find(
    (step): step is Exclude<ShotStep, ActingStep> => step.kind === 'shot' || step.kind === 'frames'
  );
  if (pictured) {
    fail(`page play reads what each step leaves, with no picture: "${pictured.kind}" is page shot --steps'.`);

    return;
  }

  const steps = parsed.filter((step): step is ActingStep => step.kind !== 'shot' && step.kind !== 'frames');
  const same = (options.same ?? []).filter((each): each is PlaySame => (PLAY_SAME as readonly string[]).includes(each));
  if (options.same && same.length !== options.same.length) {
    fail(`--same takes ${PLAY_SAME.join(', ')}: what moved, what is shown, what takes a press.`);

    return;
  }

  // Another account's step and an action reach this project's server: the other site has neither of them.
  const ours = steps.find(step => step.kind === 'as' || step.kind === 'action');
  if (ours && options.compare) {
    fail(
      `${stepText(ours)}: a step another account plays, or an action, reaches this project's own server — play it without --compare`
    );

    return;
  }

  if (same.length > 0 && !options.compare) {
    fail('--same holds the interaction to another page: give it --compare <that page>.');

    return;
  }

  const target = options.compare
    ? new URL(options.compare).pathname === '/'
      ? new URL(route, options.compare).href
      : options.compare
    : undefined;
  const plitzi = project.plitzi?.kind === 'project' ? project.plitzi : undefined;
  const where = await originHere(project.root, plitzi, options.url);
  if ('problem' in where) {
    unanswered(where.problem);

    return;
  }

  const account = await accountAsked(project.root, options.as);
  if (account === null) {
    return;
  }

  const own = options.as === undefined && options.guest !== true ? await projectAccount(project.root) : undefined;

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    unanswered(browser.problem);

    return;
  }

  const reads = readTargets(options.read).map(pairOf);
  const results: { width: number; played: PlayedStep[]; unlike: string[] }[] = [];
  try {
    for (const width of options.width ?? [1440]) {
      const ours = await ourPage(browser, where.origin, route, {
        width,
        conditions: conditionsOf(options),
        ...(options.timezone ? { timezone: options.timezone } : {}),
        ...(account ? { account } : {}),
        ...(own ? { projectAccount: own } : {}),
        ...(options.scheme ? { scheme: options.scheme } : {})
      });
      if (!ours.answered) {
        unanswered(ours.problem ?? `nothing answers at ${where.origin}${route}`);

        return;
      }

      // Who it played as, once: a run's designer read a notice bound to the visitor stay hidden, a guest unawares.
      if (ours.signedOut && results.length === 0 && options.guest !== true) {
        process.stderr.write(
          `${chalk.dim(`· ${route} played signed out — a page any visitor opens: --as <account> plays it signed in`)}\n`
        );
      }

      // The other site played warm in the kept browser, its page held for this play alone: opened cold here, it was
      // 11–19 s a call (58 plays). Not kept, it is opened here as before.
      const view = {
        width,
        height: 900,
        reducedMotion: false,
        ...(options.scheme ? { scheme: options.scheme } : {})
      };
      const held = target ? await keptSession(project.root, { url: target, ...view }) : undefined;
      if (held && 'problem' in held) {
        unanswered(held.problem);

        return;
      }

      const theirs = target && !held ? await pageAnswered(browser, target, view) : undefined;
      if (theirs && 'problem' in theirs) {
        unanswered(theirs.problem);

        return;
      }

      const there = held ? { act: held.act, read: held.read } : theirs ? pageSide(theirs.page) : undefined;
      const visitors = visitorsOn(project.root, browser, where.origin, {
        width,
        ...(options.scheme ? { scheme: options.scheme } : {}),
        ...(options.timezone ? { timezone: options.timezone } : {})
      });
      const outcome = await playOn({ here: pageSide(ours.page, visitors), ...(there ? { there } : {}) }, steps, reads, {
        actions: results.length === 0
      }).finally(async () => {
        await visitors.close();
        await held?.close();
      });
      await ours.page.close();
      await theirs?.page.close();
      if ('problem' in outcome) {
        (outcome.side === 'there' ? unanswered : fail)(`At ${String(width)} px: ${outcome.problem}`);

        return;
      }

      results.push({ width, played: outcome.played, unlike: unlikeIn(outcome.played, same) });
    }
  } finally {
    await browser.close();
  }

  const unlike = results.flatMap(each => each.unlike.map(line => `at ${String(each.width)} px, ${line}`));
  // Missing is never read at any step: one that appears after a click — the picker it opens — is what was played
  // (its picker read "not on" at the start, and the line was said to be no one's).
  const missing = results.some(each =>
    (each.played[0]?.reads ?? []).some((_read, index) =>
      each.played.every(entry => entry.reads.at(index)?.problem !== undefined)
    )
  );
  const shared = sharedServerNote(results.length, steps);
  console.log(
    options.json
      ? JSON.stringify({
          route,
          ...(target ? { compare: target } : {}),
          results,
          ...(shared ? { sharedServer: shared } : {})
        })
      : [
          ...results.flatMap(each => [
            ...(results.length > 1 ? [chalk.bold.underline(`At ${String(each.width)} px`)] : []),
            ...playedText(each.played)
          ]),
          ...verdictOf(same, unlike, missing, String(target)),
          ...(shared ? [chalk.yellow(shared)] : [])
        ].join('\n')
  );
  if (unlike.length > 0) {
    process.exitCode = 1;
  } else if (missing) {
    // An element nothing answered for is a line nobody can hold: said as such, never as a pass.
    process.exitCode = UNANSWERED_EXIT;
  }
};
