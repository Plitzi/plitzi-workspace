import { playingSteps } from './shot/steps';

import type { PlayOptions } from './play';
import type { PlayStep } from './shot/steps';

/**
 * What `page play` is asked to play and read, out of its options — the steps and the elements read after each — and
 * what it says of a play across widths.
 */

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
 * A play that failed at one width, and — past the first — that the widths before it played on the same server: a run's
 * tester dismissed a report at 390, read "not on the page" of it at 1440, and went on to try three more names.
 */
export const failedAtText = (
  width: number,
  problem: string,
  playedBefore: number,
  steps: readonly { kind: string }[]
): string => {
  const shared = playedBefore > 0 ? sharedServerNote(playedBefore + 1, steps) : undefined;

  return `At ${String(width)} px: ${problem}${shared ? `\n${shared}` : ''}`;
};

/** One thing `--read` names that is never a selector: an element's id, a list's row of one (`card:2`), a state key. */
const READ_NAME = /^(?:[\w-]+(?::(?:\d+|last))?|state\.[\w.-]+)$/;

/**
 * `--read a,b,c` as `--width 390,1440` takes them, and `--read 'a b c'` as its help says — by spaces or commas: a list of
 * names, each read; a selector's comma or space is kept (`.card, .row`, `.panel textarea`). A list holding a row
 * (`card:last`) or a state key (`state.roomRemoveAt`) is a list too: a run's scout read three as one, and a tester's
 * quoted list read as one name.
 */
export const readTargets = (read: readonly string[] = []): string[] =>
  read.flatMap(each => {
    const parts = each.split(/[\s,]+/).filter(Boolean);

    return parts.length > 1 && parts.every(part => READ_NAME.test(part)) ? parts : [each];
  });

/** The steps asked — none with `--read` alone: the page as it rests, the start read and nothing played. */
export const stepsOf = (
  options: Pick<PlayOptions, 'steps' | 'read' | 'journey' | 'width'>
): PlayStep[] | { problem: string } => {
  if ((options.steps ?? '').trim() !== '') {
    const acting = playingSteps(options.steps, 'page play', { widths: options.width ?? [1440] });

    return 'problem' in acting ? { problem: `${acting.problem}.` } : acting;
  }

  return (options.read ?? []).length > 0 || options.journey !== undefined
    ? []
    : { problem: 'page play needs --steps — or --read alone, to read the page as it rests, or --journey <id>.' };
};
