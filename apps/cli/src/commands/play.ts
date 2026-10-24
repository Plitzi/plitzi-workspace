import chalk from 'chalk';

import { launchBrowser } from '../browser';
import { accountAsked } from './check';
import { projectHere } from './existingProject';
import { ourPage, pairOf } from './measure';
import { settle } from './measureState';
import { parseSteps } from './shotSteps';
import { keptSession } from '../browser/keptBrowser';
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
  /** Signed in first as this account: the password from `PLITZI_CHECK_PASSWORD`. */
  as?: string;
  json?: boolean;
}

/** What `--same` holds: how far it moved, whether it is shown, whether it takes a press. */
export const PLAY_SAME = ['moved', 'shown', 'enabled'] as const;

export type PlaySame = (typeof PLAY_SAME)[number];

/** The ARIA states a control says of itself — what a toggle, a disclosure or a tab is at. */
export const ARIA_STATES = ['pressed', 'expanded', 'checked', 'selected'] as const;

/**
 * An element as a step leaves it: where its content is, whether it is seen, whether it takes a press — and what a
 * control says: its words, a field's value, its ARIA states, whether it holds the focus. encore: four agents wrote a
 * Playwright script for what this did not read — Listen turning Mute, the focus back on the burger, a search typed.
 */
export interface ElementState {
  /** Its content's offset — scroll less place — in whole pixels: what a move changes, however it is made. */
  offset: { x: number; y: number };
  shown: boolean;
  enabled: boolean;
  /** Its words, as a visitor reads them: whitespace folded, the first 80 characters. */
  text: string;
  /** A field's value: an input, a textarea, a select. */
  value?: string;
  /** The ARIA states it says, each as its attribute (or a box's own `checked`) is. */
  aria: Partial<Record<(typeof ARIA_STATES)[number], string>>;
  /** It holds the focus, or something inside it does. */
  focused: boolean;
}

export interface PlayedStep {
  /** `start` before any step, else the step as written. */
  step: string;
  /**
   * A side the step did nothing on — its control hidden or taking no press, as a visitor's press does nothing — and why:
   * said, never played as if it happened (lx-product: a tab drawn per width, its press at 390 skipped without a word).
   */
  idle?: Partial<Record<keyof Pair, string>>;
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
export const stateOf = (node: Element): ElementState => {
  const box = node.getBoundingClientRect();
  const style = getComputedStyle(node);
  const disabled =
    node.matches(':disabled, [aria-disabled="true"]') ||
    style.pointerEvents === 'none' ||
    node.closest('[inert]') !== null;
  // A part whose own box never scrolls but holds the row that does — a carousel named by its track, its scroller
  // inside (lx-product's dev-1 read `.carousel__scroller` by its class): that row's scroll is what moved.
  const scrolls = (each: Element): boolean => {
    const overflow = getComputedStyle(each);

    return (
      (each.scrollWidth > each.clientWidth && /auto|scroll/.test(overflow.overflowX)) ||
      (each.scrollHeight > each.clientHeight && /auto|scroll/.test(overflow.overflowY))
    );
  };
  const inner = scrolls(node) ? [] : [...node.querySelectorAll('*')].filter(scrolls);
  const scroller = inner.length === 1 ? inner[0] : node;

  return {
    offset: {
      x: Math.round(scroller.scrollLeft - box.left),
      y: Math.round(scroller.scrollTop - box.top - window.scrollY)
    },
    shown:
      box.width > 0 &&
      box.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity) > 0,
    enabled: !disabled,
    text: node.textContent.replace(/\s+/g, ' ').trim().slice(0, 80),
    ...(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement
      ? { value: node.value }
      : {}),
    // The list inline: this runs in the page, where nothing of the module is.
    aria: Object.fromEntries(
      (['pressed', 'expanded', 'checked', 'selected'] as const).flatMap(state => {
        const said = node.getAttribute(`aria-${state}`);
        const own = state === 'checked' && node instanceof HTMLInputElement && /checkbox|radio/.test(node.type);

        return said !== null ? [[state, said]] : own ? [[state, String(node.checked)]] : [];
      })
    ),
    focused:
      document.activeElement !== null && (node === document.activeElement || node.contains(document.activeElement))
  };
};

/**
 * One element's state on a page, by the way every page command names one — a Playwright selector too
 * (`:has-text("…")`): the first of it shown, else the first.
 */
export const readState = async (page: BrowserPage, target: string): Promise<ElementState | { problem: string }> => {
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
/**
 * One page a play is played on: a page of this command's, or the other site's held warm in the kept browser
 * (`keptSession`) — a step acted and waited for until the page is still, elements read as `readState` reads them.
 */
export interface PlaySide {
  act: (step: ActingStep, index: number) => Promise<{ problem: string } | undefined>;
  read: (targets: readonly string[]) => Promise<(ElementState | { problem: string })[] | { problem: string }>;
}

/** A page of this command's as a side of a play. */
export const pageSide = (page: BrowserPage): PlaySide => ({
  act: async (step, index) => {
    const problem = await actStep(page, step, index);
    // What the step started, over: its animations ended and the page's layout still — a slide, a drawer, a scroll.
    if (!problem) {
      await settle(page);
    }

    return problem;
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
  reads: readonly Pair[]
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
    for (const name of sides.there ? (['here', 'there'] as const) : (['here'] as const)) {
      const side = name === 'here' ? sides.here : sides.there;
      if (!side) {
        continue;
      }

      // A press on a control out of use — hidden, disabled, passing the pointer on — does nothing, as a visitor's does:
      // played as such, never a failure; what it left is read as after any step.
      const acting = sideOf(step, name);
      if (acting.kind === 'click' || acting.kind === 'drag' || acting.kind === 'type') {
        const state = (await readSide(side, [acting.target])).at(0);
        if (state && !('problem' in state) && (!state.shown || !state.enabled)) {
          idle[name] =
            `${acting.target} ${state.shown ? 'takes no press' : 'is not shown'}: the ${acting.kind} did nothing`;
          continue;
        }
      }

      try {
        const problem = await side.act(acting, index);
        if (problem) {
          return { problem: problem.problem, side: name };
        }
      } catch (error) {
        return {
          problem: `Step ${String(index + 1)} (${stepText(step)}) did not happen${name === 'there' ? ' there' : ''}: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`,
          side: name
        };
      }
    }

    const entry = await readAll(stepText(step));
    played.push(Object.keys(idle).length > 0 ? { ...entry, idle } : entry);
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
    `${state.shown ? 'shown' : 'hidden'}, ${state.enabled ? 'enabled' : 'no press'}`,
    ...(state.focused ? ['focused'] : []),
    ...Object.entries(state.aria).map(([name, value]) => `${name} ${value}`),
    ...(state.value !== undefined ? [`value "${state.value}"`] : []),
    ...(state.text ? [`"${state.text}"`] : [])
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

  return played.flatMap(entry => [
    chalk.bold(entry.step),
    ...(entry.idle?.here ? [chalk.yellow(`  here: ${entry.idle.here}`)] : []),
    ...(entry.idle?.there ? [chalk.yellow(`  there: ${entry.idle.there}`)] : []),
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

/**
 * What `--same` says of the steps: each difference, or that they held — never a pass while an element read is not on
 * the page, which holds nothing (lx-product: "✓ every step as theirs" beside one not built yet).
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

  const account = await accountAsked(project.root, options.as);
  if (account === null) {
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
        ...(account ? { account } : {}),
        ...(options.scheme ? { scheme: options.scheme } : {})
      });
      if (!ours.answered) {
        unanswered(ours.problem ?? `nothing answers at ${where.origin}${route}`);

        return;
      }

      // The other site played warm in the kept browser, its page held for this play alone: opened cold here, it was
      // 11–19 s a call (lx-product, 58 plays). Not kept, it is opened here as before.
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
      const outcome = await playOn({ here: pageSide(ours.page), ...(there ? { there } : {}) }, steps, reads).finally(
        () => held?.close()
      );
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
          ...verdictOf(same, unlike, missing, String(target))
        ].join('\n')
  );
  if (unlike.length > 0) {
    process.exitCode = 1;
  } else if (missing) {
    // An element nothing answered for is a line nobody can hold: said as such, never as a pass.
    process.exitCode = UNANSWERED_EXIT;
  }
};
