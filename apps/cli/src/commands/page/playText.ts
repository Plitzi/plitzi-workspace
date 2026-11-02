import chalk from 'chalk';

import { heldText } from './playHeld';
import { givenText } from './playState';

import type { PlayedStep } from './play';
import type { ElementState } from './playState';

/**
 * `page play`'s answer in words: each step, what it did to every element read — moved, shown, pressed, its text — and
 * where the page went by itself.
 */

/** How much of an element's text a line of `--read` shows; `--json` has it whole. */
const TEXT_SHOWN = 80;

/** How far an element moved, in words: `12px left, 3px up`, or nothing. */
export const moveText = ({ x, y }: { x: number; y: number }): string =>
  x === 0 && y === 0
    ? 'nothing'
    : [
        x === 0 ? '' : `${String(Math.abs(x))}px ${x > 0 ? 'left' : 'right'}`,
        y === 0 ? '' : `${String(Math.abs(y))}px ${y > 0 ? 'up' : 'down'}`
      ]
        .filter(Boolean)
        .join(', ');

const stateText = (state: ElementState, before?: ElementState): string =>
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
    ...(state.own === undefined ? [] : [`its own state ${state.own}`]),
    ...givenText(state.given, before?.given, state.copies),

    ...(state.text
      ? [
          `"${state.text.length > TEXT_SHOWN ? `${state.text.slice(0, TEXT_SHOWN)}…" (--json has its ${String(state.text.length)} characters)` : `${state.text}"`}`
        ]
      : [])
  ].join(' · ');

/** Where a page went by itself as it opened, each address but the last with how long it was shown. */
export const passedText = (route: string, passed: readonly { path: string; ms: number }[]): string =>
  `· ${route} went on by itself as it opened: ${passed
    .map((each, index) => (index === passed.length - 1 ? each.path : `${each.path} (shown ${String(each.ms)} ms)`))
    .join(' → ')} — the start is read there`;

/** What a step changed of an edge — a ring lit, a border coloured — each part as it is now and was. */
const edgeChange = (before: ElementState['edge'], now: ElementState['edge']): string =>
  (['border', 'outline', 'shadow'] as const)
    .filter(part => before[part] !== now[part])
    .map(part => ` · ${part} now ${now[part]} (was ${before[part]})`)
    .join('');

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
    const edgeBefore = at === 0 ? undefined : played[at - 1]?.reads.at(index)?.here?.edge;
    const edge = read.here && edgeBefore ? edgeChange(edgeBefore, read.here.edge) : '';
    const hereBefore = at === 0 ? undefined : played[at - 1]?.reads.at(index)?.here;
    const here = `${said && read.moved ? `moved ${moveText(read.moved.here)}, ` : ''}${read.here ? stateText(read.here, hereBefore) : ''}${colour}${edge}`;
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
    ...(entry.failed ?? []).map(flow => chalk.red(`  ✗ ${flow}`)),
    ...(entry.pictured?.here ? [`  ▣ ${entry.pictured.here}`] : []),
    ...(entry.pictured?.there ? [chalk.dim(`  ▣ there ${entry.pictured.there}`)] : []),
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

      // Read again as it was — the same state, nothing moved: said so — a run's nine steps repeated two elements whole
      // at each, 21k characters. By the reads, not their lines: a line says what a step changed, never the same twice.
      const earlier = at > 0 ? played[at - 1]?.reads.at(index) : undefined;
      const still = (moved: NonNullable<typeof read.moved>['here'] | undefined): boolean =>
        moved === undefined || (moved.x === 0 && moved.y === 0);
      const same =
        earlier !== undefined &&
        earlier.problem === undefined &&
        JSON.stringify([earlier.here, earlier.there]) === JSON.stringify([read.here, read.there]) &&
        still(read.moved?.here) &&
        still(read.moved?.there);

      return [same ? `  ${read.element}: ${chalk.dim('as before')}` : readLine(at, index)];
    }),
    ...heldText(played, at)
  ]);
};
