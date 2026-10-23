import chalk from 'chalk';

import { launchBrowser } from '../browser';
import { projectHere } from './existingProject';
import { ourPage, pairOf } from './measure';
import { settle } from './measureState';
import { parseSteps } from './shotSteps';
import { originHere } from '../runs/copyServer';
import { targetOn } from './shot/capture';
import { pageAnswered } from './shot/remote';
import { actStep } from './shot/steps';
import { fail, unanswered, UNANSWERED_EXIT } from './terminal';

import type { BrowserPage, Scheme } from '../browser';
import type { Pair } from './measure';
import type { ActingStep } from './shot/steps';
import type { ShotStep } from './shotSteps';

/**
 * `plitzi page play`: an interaction played step by step — a press, a drag, a key — and, after each step, how far each
 * element read moved and how it stands (shown, enabled), on the project's page and, with `--compare`, on the other
 * site's at once; `--same` fails where the two do otherwise. What a control does, read as numbers and held by an
 * acceptance line: every run so far had its agents and its lead write browser scripts for it (lx-controls: two dozen,
 * a carousel's arrows used there and back on both sites).
 *
 * How far something moved is how far its content went: its scroll less its place — the same number for a row that
 * scrolls its box and one that slides its track by a transform, whichever way each site builds it.
 */

export interface PlayOptions {
  steps: string;
  /** The elements read after each step, `"ours => theirs"` with `--compare`. */
  read?: string[];
  compare?: string;
  /** What must be as the other page's after every step: `moved`, `shown`, `enabled`. */
  same?: string[];
  width?: number[];
  scheme?: Scheme;
  url?: string;
  json?: boolean;
}

/** What `--same` holds: how far it moved, whether it is shown, whether it takes a press. */
export const PLAY_SAME = ['moved', 'shown', 'enabled'] as const;

export type PlaySame = (typeof PLAY_SAME)[number];

/** An element as a step leaves it: where its content is, whether it is seen, whether it takes a press. */
export interface ElementState {
  /** Its content's offset — scroll less place — in whole pixels: what a move changes, however it is made. */
  offset: { x: number; y: number };
  shown: boolean;
  enabled: boolean;
}

export interface PlayedStep {
  /** `start` before any step, else the step as written. */
  step: string;
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

/** Run in the page, on the element: where its content is, whether it is seen, whether it takes a press. */
const stateOf = (node: Element): ElementState => {
  const box = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  const disabled =
    node.matches(':disabled, [aria-disabled="true"]') ||
    style.pointerEvents === 'none' ||
    node.closest('[inert]') !== null;

  return {
    offset: { x: Math.round(node.scrollLeft - box.left), y: Math.round(node.scrollTop - box.top - window.scrollY) },
    shown:
      box.width > 0 &&
      box.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity) > 0,
    enabled: !disabled
  };
};

/**
 * One element's state on a page, by the way every page command names one — a Playwright selector too
 * (`:has-text("…")`): the first of it shown, else the first.
 */
const readState = async (page: BrowserPage, target: string): Promise<ElementState | { problem: string }> => {
  const found = await targetOn(page, target);
  if ('problem' in found) {
    return found;
  }

  if (!found.found) {
    return { problem: `${target} is not on ${page.url()}` };
  }

  const located = page.locator(found.selector);
  const visible = located.filter({ visible: true }).first();

  return ((await visible.count()) > 0 ? visible : located.first()).evaluate(stateOf, undefined);
};

/** A step as one side plays it: its element that side's, from `"ours => theirs"`. */
const sideOf = (step: ActingStep, side: keyof Pair): ActingStep =>
  'target' in step ? { ...step, target: pairOf(step.target)[side] } : step;

const stepText = (step: ActingStep): string =>
  step.kind === 'press'
    ? `press ${step.key}`
    : step.kind === 'wait'
      ? `wait ${String(step.ms)} ms`
      : step.kind === 'drag'
        ? `drag ${step.target} ${String(step.dx)} ${String(step.dy)}`
        : `${step.kind} ${step.target}`;

/** The steps, each played on each page, every element read after it — or what kept a step from happening. */
export const playOn = async (
  pages: { here: BrowserPage; there?: BrowserPage },
  steps: readonly ActingStep[],
  reads: readonly Pair[]
): Promise<{ played: PlayedStep[] } | { problem: string; side: keyof Pair }> => {
  const played: PlayedStep[] = [];
  let last: PlayedStep | undefined;
  const readAll = async (label: string): Promise<PlayedStep> => {
    const entry: PlayedStep = { step: label, reads: [] };
    for (const [index, pair] of reads.entries()) {
      const here = await readState(pages.here, pair.here);
      const there = pages.there ? await readState(pages.there, pair.there) : undefined;
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
        element: pages.there ? `${pair.here} => ${pair.there}` : pair.here,
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
    for (const side of pages.there ? (['here', 'there'] as const) : (['here'] as const)) {
      const page = side === 'here' ? pages.here : pages.there;
      if (!page) {
        continue;
      }

      // A press on a control out of use — hidden, disabled, passing the pointer on — does nothing, as a visitor's does:
      // played as such, never a failure; what it left is read as after any step.
      const acting = sideOf(step, side);
      if (acting.kind === 'click' || acting.kind === 'drag' || acting.kind === 'type') {
        const state = await readState(page, acting.target);
        if (!('problem' in state) && (!state.shown || !state.enabled)) {
          continue;
        }
      }

      try {
        const problem = await actStep(page, acting, index);
        if (problem) {
          return { problem: problem.problem, side };
        }
      } catch (error) {
        return {
          problem: `Step ${String(index + 1)} (${stepText(step)}) did not happen${side === 'there' ? ' there' : ''}: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`,
          side
        };
      }

      // What the step started, over: its animations ended and the page's layout still — a slide, a drawer, a scroll.
      await settle(page);
    }

    played.push(await readAll(stepText(step)));
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
  `${state.shown ? 'shown' : 'hidden'}, ${state.enabled ? 'enabled' : 'no press'}`;

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

  return played.flatMap(entry => [
    chalk.bold(entry.step),
    ...entry.reads.map((read, index) => {
      if (read.problem) {
        return `  ${read.element}: ${chalk.red(read.problem)}`;
      }

      const said = moves(index) && read.moved !== undefined;
      const here = `${said && read.moved ? `moved ${moveText(read.moved.here)}, ` : ''}${read.here ? stateText(read.here) : ''}`;
      const there = read.there
        ? chalk.dim(
            ` | there ${said && read.moved?.there ? `moved ${moveText(read.moved.there)}, ` : ''}${stateText(read.there)}`
          )
        : '';

      return `  ${read.element}: ${here}${there}`;
    })
  ]);
};

export const play = async (route: string, options: PlayOptions): Promise<void> => {
  const project = await projectHere('whose page to play');
  if (!project) {
    return;
  }

  const parsed = parseSteps(options.steps, 500);
  if ('problem' in parsed) {
    fail(`--steps: ${parsed.problem}.`);

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

  const browser = await launchBrowser(project.root);
  if ('problem' in browser) {
    unanswered(browser.problem);

    return;
  }

  const reads = (options.read ?? []).map(pairOf);
  const results: { width: number; played: PlayedStep[]; unlike: string[] }[] = [];
  try {
    for (const width of options.width ?? [1440]) {
      const ours = await ourPage(browser, where.origin, route, {
        width,
        ...(options.scheme ? { scheme: options.scheme } : {})
      });
      if (!ours.answered) {
        unanswered(`nothing answers at ${where.origin}${route}`);

        return;
      }

      const theirs = target
        ? await pageAnswered(browser, target, {
            width,
            height: 900,
            reducedMotion: false,
            ...(options.scheme ? { scheme: options.scheme } : {})
          })
        : undefined;
      if (theirs && 'problem' in theirs) {
        unanswered(theirs.problem);

        return;
      }

      const outcome = await playOn({ here: ours.page, ...(theirs ? { there: theirs.page } : {}) }, steps, reads);
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
  const missing = results.some(each => each.played.some(entry => entry.reads.some(read => read.problem)));
  console.log(
    options.json
      ? JSON.stringify({ route, ...(target ? { compare: target } : {}), results })
      : [
          ...results.flatMap(each => [
            ...(results.length > 1 ? [chalk.bold.underline(`At ${String(each.width)} px`)] : []),
            ...playedText(each.played)
          ]),
          ...(same.length > 0
            ? unlike.length === 0
              ? [chalk.green(`✓ --same ${same.join(',')}: every step as ${String(target)}'s`)]
              : unlike.map(line => chalk.red(`✗ --same: ${line}`))
            : [])
        ].join('\n')
  );
  if (unlike.length > 0) {
    process.exitCode = 1;
  } else if (missing) {
    // An element nothing answered for is a line nobody can hold: said as such, never as a pass.
    process.exitCode = UNANSWERED_EXIT;
  }
};
