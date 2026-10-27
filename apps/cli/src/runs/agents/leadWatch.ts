import fs from 'node:fs/promises';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { askStandings } from './askStandings';
import { launchAsked } from './keeper';
import { FOLLOW_MS } from '../../options';
import { readJson, writeJson } from '../core/files';
import { runPaths } from '../core/paths';
import { isRunRefusal } from '../core/refusal';
import { runChanged } from '../core/runChanged';
import { loadRun } from '../run';
import { LEAD, markRead, messagesOf } from '../talk/messages';
import { QUIET_ADVICE } from '../view/bottlenecks';
import { viewRun } from '../view/view';

import type { RunContext } from '../run';
import type { Attention, RunView } from '../view/view';

/**
 * `plitzi run watch`: what a lead waiting in the background runs — it ends the moment the run has
 * something new for the lead (a task in review, a question, a block, a notice), so the lead is woken for it instead of
 * reading the run over and over. Each is said once: what it woke the lead for is kept in the run (`lead-seen.json`).
 */

/** How long an agent the run asks for is the keeper's to start before the lead hears of it: a few of its looks. */
export const KEEPER_GRACE_MS = 90_000;

export interface LeadItem {
  key: string;
  text: string;
  /** A message only to know: its id — shown whole in `run watch`, and read by it. */
  message?: string;
  /** A message only to know that the lead decides on all the same — a standing its agent answered: it wakes the lead. */
  wakes?: true;
  /** Advice that waits for the lead's next wake (`QUIET_ADVICE`): said with what wakes it, or as the watch ends. */
  quiet?: true;
}

export interface LeadNews {
  fresh: LeadItem[];
  view?: RunView;
  /** The run finished or was aborted while it waited. */
  gone?: true;
  /** Nothing that needs the lead within the time it was given — what is only to know, if any, in `fresh`. */
  timedOut?: true;
}

// What says how long something has lasted changes its words every minute: it is the same notice all the same. So does
// a task held up behind another — its words name that one's state and who is free (the lead woken three
// times for one "t-shell waits for t-base" it had kept on purpose, each time t-base's review moved).
const TIMED = new Set<Attention['kind']>([
  'no-signal',
  'long-wait',
  'stopping',
  'slow-review',
  'review-waits',
  'refused-again',
  'held-up',
  'held-ahead'
]);

/**
 * What needs the lead in `view`, each by a key that stays while it is the same thing — a review by its round and step.
 * The lead is the manager: it is woken for a step of a review that is its own — named by the card, or one nobody else
 * may say (`reviews.ts`) — and what a reviewer escalates, or a task past its review rounds, comes blocked on it among the
 * run's attention.
 */
export const leadItems = (view: RunView): LeadItem[] => [
  // Every task approved: the close is the lead's — a run's watch said "nothing new" and the run sat finished.
  ...(view.total > 0 && view.done === view.total && (view.status === 'open' || view.status === 'stopping')
    ? [
        {
          key: `all-approved:${String(view.total)}`,
          text: `Every task is approved (${String(view.total)}): close the run — plitzi run look (every page it changed), plitzi run report --summary <file> --ease <1-5> --hardest "…", then plitzi run finish`
        }
      ]
    : []),
  // A step that is the lead's: its card names the lead, or nobody else may say it — a step before it is not the lead's yet.
  ...view.tasks
    .filter(
      task =>
        task.status === 'in-review' &&
        // A scout's proposal wakes the lead as itself (`spike-proposed`), never as a review to say.
        task.proposed === undefined &&
        task.review?.lead === true
    )
    .map(task => {
      const review = task.review;
      const why =
        review?.why ??
        `nobody else may say its ${review?.role ?? ''}'s review: each of its role and each developer worked it, or what it tests`;

      return {
        key: `review:${task.id}:${String(task.round)}:${String(review?.step ?? 0)}:${task.takenAt ?? ''}`,
        text: `${task.id} is in review, yours to review (${why}): plitzi task look ${task.id}, then plitzi task review ${task.id} --approve | --changes "…"`
      };
    }),
  ...view.attention
    .filter(item => item.who !== 'task')
    .map(item => ({
      key: TIMED.has(item.kind)
        ? `${item.kind}:${item.task ?? ''}`
        : item.file !== undefined
          ? `${item.kind}:${item.task ?? ''}:${item.file}`
          : item.subject !== undefined
            ? `${item.kind}:${item.task ?? ''}:${item.subject}`
            : `${item.kind}:${item.task ?? ''}:${item.text}`,
      text: item.text,
      ...(item.fyi && item.message ? { message: item.message } : {}),
      ...(item.decide ? { wakes: true as const } : {}),
      ...(QUIET_ADVICE.includes(item.kind) ? { quiet: true as const } : {})
    }))
];

/**
 * Whether an item wakes the lead: what needs it does — a standing answered too, which it decides on — and what is only to
 * know (a note) or advice that waits (`QUIET_ADVICE`) comes with it, or as the watch ends.
 */
export const wakesLead = (item: LeadItem): boolean =>
  item.wakes === true || (item.message === undefined && item.quiet !== true);

const isKeys = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(each => typeof each === 'string');

export const waitForLead = async (
  ctx: RunContext,
  runId: string,
  {
    timeoutMs = FOLLOW_MS,
    everyMs = 10_000,
    // The run's keeper starts the agents when one runs: the watch starts them only when none does — two starting one
    // agent at once told the lead it "could not be started" (a run's design-1 and test-1).
    launch = true
  } = {}
): Promise<LeadNews> => {
  let watching: string;
  try {
    watching = (await loadRun(ctx, runId, { anyMachine: true, anyVersion: true })).paths.leadWatching;
  } catch (error) {
    if (isRunRefusal(error) && error.code === 'not-found') {
      return { fresh: [], gone: true };
    }

    throw error;
  }

  const mine: Watching = { pid: process.pid, at: ctx.now().toISOString() };
  await writeJson(watching, mine);
  try {
    return await waitWatched(ctx, runId, { timeoutMs, everyMs, launch });
  } finally {
    // Only its own: a second watch started meanwhile keeps the lead watching.
    const now = await readJson(watching, isWatching, 'the lead watching');
    if (now?.pid === mine.pid && now.at === mine.at) {
      await fs.rm(watching, { force: true });
    }
  }
};

/** The lead's `run watch` while it waits, as it marks it: what the monitor reads the lead watching by. */
export interface Watching {
  pid: number;
  at: string;
}

export const isWatching = (value: unknown): value is Watching =>
  isRecord(value) && typeof value.pid === 'number' && typeof value.at === 'string';

/** Whether the lead watches the run now: its watch's mark, and that process still there. */
export const leadWatching = async (file: string): Promise<Watching | undefined> => {
  const mark = await readJson(file, isWatching, 'the lead watching');
  if (mark === undefined) {
    return undefined;
  }

  try {
    process.kill(mark.pid, 0);

    return mark;
  } catch (error) {
    // EPERM: it runs, as another user — only ESRCH says it is gone.
    return isRecord(error) && error.code === 'EPERM' ? mark : undefined;
  }
};

const waitWatched = async (
  ctx: RunContext,
  runId: string,
  { timeoutMs, everyMs, launch }: { timeoutMs: number; everyMs: number; launch: boolean }
): Promise<LeadNews> => {
  const started = Date.now();
  // With a keeper, starting an agent the run asks for is its: the lead hears of one only once it stayed unstarted past
  // the keeper's look — a run's lead was told "start dev-1" in the seconds the keeper took to start it again.
  const needSince = new Map<string, number>();
  for (;;) {
    let view: RunView;
    let seenFile: string;
    let failedLaunches: LeadItem[] = [];
    try {
      seenFile = (await loadRun(ctx, runId, { anyMachine: true, anyVersion: true })).paths.leadSeen;
      view = await viewRun(ctx, runId);
      const launched = launch ? await launchAsked(ctx, runId, view) : { started: [], failed: [] };
      failedLaunches = launched.failed.map(({ agent, message }) => ({
        key: `launch-failed:${agent}:${message}`,
        text: `${agent} could not be started (options.launch): ${message} — start it yourself, plitzi run agent ${agent} --launch --harness <yours>`
      }));
      // Those started are running from now, and a long card's agent asked where it stands is the lead's to hear from:
      // read again, neither asks for the lead.
      const asked = await askStandings(ctx, runId, view);
      if (launched.started.length > 0 || asked.length > 0) {
        view = await viewRun(ctx, runId);
      }
    } catch (error) {
      if (isRunRefusal(error) && error.code === 'not-found') {
        return { fresh: [], gone: true };
      }

      throw error;
    }

    const seen = new Set((await readJson(seenFile, isKeys, 'what the lead was woken for')) ?? []);
    const now = ctx.now().getTime();
    // By the agent asked for, whatever the words: they change as the work waiting does.
    const asked = new Map(
      view.attention.filter(item => item.kind === 'agents-needed').map(item => [item.text, item.agent ?? item.text])
    );
    const agents = new Set(asked.values());
    for (const agent of [...needSince.keys()].filter(agent => !agents.has(agent))) {
      needSince.delete(agent);
    }

    for (const agent of agents) {
      needSince.set(agent, needSince.get(agent) ?? now);
    }

    const keeperHasIt = (item: LeadItem): boolean => {
      const agent = asked.get(item.text);

      return !launch && agent !== undefined && now - (needSince.get(agent) ?? now) < KEEPER_GRACE_MS;
    };
    const fresh = [...failedLaunches, ...leadItems(view)].filter(item => !seen.has(item.key) && !keeperHasIt(item));
    // What is only to know wakes nobody: it comes with what does, or as the watch ends — a run's lead was woken
    // three times for notes, each turn reading its whole context again.
    const over = Date.now() - started >= timeoutMs;
    // A standing answered is the lead's to decide on: a run's came as a note and waited for the watch's end.
    if (fresh.some(wakesLead) || (over && fresh.length > 0)) {
      await writeJson(seenFile, [...seen, ...fresh.map(item => item.key)]);
      // What is only to know, shown whole here, is read: it leaves what needs the lead (Carlos: what was looked at
      // stays no longer).
      const known = view.attention.flatMap(item => (item.fyi && item.message ? [item.message] : []));
      if (known.length > 0) {
        const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
        await markRead(loaded, LEAD, known);
        // Shown whole, as it is read: the inbox is no step after it.
        const whole = new Map((await messagesOf(loaded)).map(message => [message.id, message] as const));
        for (const item of fresh) {
          const message = item.message === undefined ? undefined : whole.get(item.message);
          if (message && item.wakes !== true) {
            item.text = `${message.from} says (${message.id}), for you to know: ${message.text}`;
          }
        }
      }

      return { fresh, view, ...(fresh.some(wakesLead) ? {} : { timedOut: true as const }) };
    }

    if (over) {
      return { fresh: [], view, timedOut: true };
    }

    await runChanged(runPaths(ctx.root, runId).dir, everyMs);
  }
};
