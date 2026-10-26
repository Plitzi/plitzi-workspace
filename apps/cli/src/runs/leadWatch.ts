import { readJson, writeJson } from './files';
import { FOLLOW_MS } from '../options';
import { launchAsked } from './keeper';
import { LEAD, markRead, messagesOf } from './messages';
import { runPaths } from './paths';
import { isRunRefusal } from './refusal';
import { loadRun } from './run';
import { runChanged } from './runChanged';
import { viewRun } from './view';

import type { RunContext } from './run';
import type { Attention, RunView } from './view';

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
}

export interface LeadNews {
  fresh: LeadItem[];
  view?: RunView;
  /** The run finished or was aborted while it waited. */
  gone?: true;
  /** Nothing new within the time it was given. */
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
  'ui-queued',
  'refused-again',
  'held-up',
  'held-ahead'
]);

/**
 * What needs the lead in `view`, each by a key that stays while it is the same thing — a review by its round. The lead
 * is the manager: with testers in the team it is woken only for a review nobody else may take (`leadReviews`) — what a
 * tester escalates, or a task past its review rounds, comes blocked on it among the run's attention — and with none, for
 * every task in review once its designer said.
 */
export const leadItems = (view: RunView): LeadItem[] => [
  // Every task approved: the close is the lead's — encore-10's watch said "nothing new" and the run sat finished.
  ...(view.total > 0 && view.done === view.total && (view.status === 'open' || view.status === 'stopping')
    ? [
        {
          key: `all-approved:${String(view.total)}`,
          text: `Every task is approved (${String(view.total)}): close the run — plitzi run look (every page it changed), plitzi run report --summary <file> --ease <1-5> --hardest "…", then plitzi run finish`
        }
      ]
    : []),
  // One a designer is still to look at is not the lead's yet: it wakes the lead once the designer said.
  ...view.tasks
    .filter(
      task =>
        task.status === 'in-review' &&
        // A scout's proposal wakes the lead as itself (`spike-proposed`), never as a review to say.
        task.proposed === undefined &&
        task.design?.status !== 'due' &&
        (view.reviewers.length === 0 || task.leadReviews === true)
    )
    .map(task => {
      const why =
        view.reviewers.length === 0
          ? 'the team has no tester'
          : 'nobody else may: each tester and developer worked it, or what it tests — it would hold the run';

      return {
        key: `review:${task.id}:${String(task.round)}:${task.takenAt ?? ''}:${task.design?.status ?? ''}`,
        text:
          task.design?.status === 'approved'
            ? `${task.id} is in review, its UI approved by ${task.design.by ?? 'a designer'} — yours is the final review (${why}): plitzi task look ${task.id}, then plitzi task review ${task.id} --approve | --changes "…"`
            : `${task.id} is in review, yours to review (${why}): plitzi task review ${task.id} --approve | --changes "…"`
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
      ...(item.fyi && item.message ? { message: item.message } : {})
    }))
];

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
      // Those started are running from now: read again, they no longer ask for the lead.
      if (launched.started.length > 0) {
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
    if (fresh.length > 0) {
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
          if (message) {
            item.text = `${message.from} says (${message.id}), for you to know: ${message.text}`;
          }
        }
      }

      return { fresh, view };
    }

    if (Date.now() - started >= timeoutMs) {
      return { fresh: [], view, timedOut: true };
    }

    await runChanged(runPaths(ctx.root, runId).dir, everyMs);
  }
};
