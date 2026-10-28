import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { PlayedStep } from './play';

/**
 * The page's state in a play: `--read state.<key>`, each key read after every step — a reviewer held a toggle's limit to
 * three crates and had no way to read the list it kept between the presses.
 */

/** A key of the page's state as a step left it — undefined while it is unset. */
export interface HeldRead {
  key: string;
  value?: unknown;
}

/** `state.<key>` of `--read`: a key of the page's state, a dotted path into it — never an element. */
const STATE_READ = /^state\.(.+)$/;

/** What `--read` asks of the page's state, and the elements it reads. */
export const stateReadsOf = (targets: readonly string[]): { keys: string[]; elements: string[] } => ({
  keys: targets.flatMap(each => STATE_READ.exec(each)?.[1] ?? []),
  elements: targets.filter(each => !STATE_READ.test(each))
});

/** The value at a dotted path of the state: a list's place by its number (`crates.0`). */
export const valueAt = (state: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (at, part) =>
        Array.isArray(at) ? at.at(Number(part)) : isRecord(at) && Object.hasOwn(at, part) ? at[part] : undefined,
      state
    );

/** The longest a state value is shown: past it, its size — `--json` has it whole. */
const HELD_SHOWN = 200;

/** A state value in a line: unset, as it is, or cut with its length. */
const heldValueText = (value: unknown): string => {
  if (value === undefined) {
    return chalk.dim('unset');
  }

  const text = JSON.stringify(value);
  const size = Array.isArray(value) ? ` (a list of ${String(value.length)})` : '';

  return text.length > HELD_SHOWN ? `${text.slice(0, HELD_SHOWN)}…${size} — --json has it whole` : `${text}${size}`;
};

/** The state keys read at step `at`: each as that step left it — as before when it did not change it. */
export const heldText = (played: readonly PlayedStep[], at: number): string[] => {
  const held = played[at]?.held;
  if (held === undefined) {
    return [];
  }

  if ('problem' in held) {
    // Never readable: said once, at the start.
    return at === 0 ? [`  state: ${chalk.red(held.problem)} ${chalk.dim('(at every step)')}`] : [];
  }

  const before = at === 0 ? undefined : played[at - 1]?.held;

  return held.map(({ key, value }) => {
    const was = before && !('problem' in before) ? before.find(each => each.key === key) : undefined;

    return was && JSON.stringify(was.value) === JSON.stringify(value)
      ? `  state.${key}: ${chalk.dim('as before')}`
      : `  state.${key}: ${heldValueText(value)}`;
  });
};
