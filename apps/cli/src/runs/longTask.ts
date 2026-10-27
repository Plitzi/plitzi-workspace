import { workLimitOf } from './limits';
import { agentAddress, LEAD } from './messages';

import type { Message } from './messages';
import type { Attention } from './view';

/**
 * A card at work past its limit (`workLimitOf`: 10 min, the scope 30), and again at each limit more: past it something
 * is usually wrong, and the lead decides on where it stands (Carlos). The run asks its agent itself (`askStandings`, from
 * the lead's watch and the keeper): encore-14's lead was woken for two long research cards and asked neither — the lead
 * is woken with the answer to decide on, or, with none in time, to decide without it.
 */

/** How long the run waits for the standing it asked before the lead decides without it. */
export const STANDING_GRACE_MS = 3 * 60_000;

export interface LongTask {
  id: string;
  agent: string;
  takenAt: string;
  spentMinutes: number;
  estimateMinutes: number;
  /** What its agent last said of its progress. */
  step?: string;
}

const clock = (at: string): string => at.slice(11, 16);

const glimpse = (text: string): string => (text.length > 400 ? `${text.slice(0, 399)}…` : text);

/** What the lead decides on a long card, whatever its agent answered. */
const DECIDE =
  'let it go on; tell it what to change (plitzi task message); narrow it (plitzi run amend), split it (plitzi run extend), or take it back (plitzi task reassign)';

/**
 * What a long card asks of the lead now: its standing to be asked (`asks` — the run asks it itself), nothing while its
 * agent has the time to answer or once it answered (its answer wakes the lead), or the lead's decision without it.
 */
export const longTaskAttention = (task: LongTask, messages: readonly Message[], now: Date): Attention | undefined => {
  const limit = workLimitOf(task.id);
  const limits = Math.floor(task.spentMinutes / limit);
  if (limits < 1) {
    return undefined;
  }

  const crossedAt = Date.parse(task.takenAt) + limits * limit * 60_000;
  const addresses = [task.id, agentAddress(task.agent)];
  // Every asking since the limit was crossed: the lead's watch and the keeper may both have asked.
  const asked = messages.filter(
    message =>
      message.from === LEAD &&
      message.asksStanding === true &&
      addresses.includes(message.to) &&
      Date.parse(message.at) >= crossedAt
  );
  const said = task.step === undefined ? '' : `; ${task.agent} last said: "${glimpse(task.step)}"`;
  const past = `${task.id} has taken ${String(task.spentMinutes)} min — past the ${String(limit)} a piece of work takes before something is usually wrong (estimated ${String(task.estimateMinutes)})${said}`;
  if (asked.length === 0) {
    return {
      kind: 'long-task',
      task: task.id,
      subject: `x${String(limits)}`,
      asks: task.agent,
      text: `${past}: ask ${task.agent} where it stands — plitzi task message @${task.agent} --standing — and decide on its answer: ${DECIDE}`,
      who: 'lead'
    };
  }

  const [first] = asked;
  const answered = messages.some(message => asked.some(each => each.id === message.replyTo));
  const waited = now.getTime() - Date.parse(first.at);
  if (answered || waited < STANDING_GRACE_MS) {
    return undefined;
  }

  return {
    kind: 'long-task',
    task: task.id,
    subject: `x${String(limits)}:unanswered`,
    text: `${past}. Asked where it stands at ${clock(first.at)} UTC, no answer in ${String(Math.floor(waited / 60_000))} min — ${task.agent} is at something long of its own, and hears you only when it ends: decide without it — ${DECIDE}`,
    who: 'lead'
  };
};
