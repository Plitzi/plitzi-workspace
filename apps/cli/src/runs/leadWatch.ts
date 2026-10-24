import { readJson, writeJson } from './files';
import { FOLLOW_MS } from '../options';
import { commandAs } from './identity';
import { harnessOf, launchAgent } from './launchAgent';
import { REVIEW_BACKLOG_MS, UNTAKEN_REVIEW_MS } from './leads';
import { LEAD, markRead, messagesOf } from './messages';
import { runPaths } from './paths';
import { isRunRefusal } from './refusal';
import { loadRun } from './run';
import { runChanged } from './runChanged';
import { readTeam } from './team';
import { viewRun } from './view';

import type { RunContext } from './run';
import type { Attention, RunView } from './view';

/**
 * `plitzi run watch --until lead`: what a lead waiting in the background runs — it ends the moment the run has
 * something new for the lead (a task in review, a question, a block, a notice), so the lead is woken for it instead of
 * reading the run over and over. Each is said once: what it woke the lead for is kept in the run (`lead-seen.json`).
 */

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
// a task held up behind another — its words name that one's state and who is free (lx-copy: the lead woken three
// times for one "t-shell waits for t-base" it had kept on purpose, each time t-base's review moved).
const TIMED = new Set<Attention['kind']>([
  'no-signal',
  'long-wait',
  'long-task',
  'stopping',
  'slow-review',
  'ui-queued',
  'refused-again',
  'held-up'
]);

/** A review no lead took this round, by how long it has waited. */
const untaken = (view: RunView, now: Date): { task: RunView['tasks'][number]; waited: number }[] =>
  view.tasks
    .filter(task => task.status === 'in-review' && task.design?.status !== 'due' && task.reviewer === undefined)
    .map(task => ({ task, waited: now.getTime() - Date.parse(task.since ?? view.openedAt) }))
    .sort((a, b) => b.waited - a.waited);

const minutes = (ms: number): string => String(Math.round(ms / 60_000));

/**
 * What needs the lead in `view`, each by a key that stays while it is the same thing — a review by its round. `lead`
 * reviews every task while no lead that reviews runs, and is told to start one once two wait and the oldest waited
 * `REVIEW_BACKLOG_MS`; while one runs, it is woken for a review only once none took it within `UNTAKEN_REVIEW_MS`.
 */
export const leadItems = (view: RunView, now: Date): LeadItem[] => {
  const waiting = untaken(view, now);
  // A lead that reviews is running while it asks for reviews, and while it reviews one it took.
  const reviewing = view.tasks.flatMap(task =>
    task.status === 'in-review' && task.reviewer !== undefined && view.leads.includes(task.reviewer)
      ? [task.reviewer]
      : []
  );
  const running = [...new Set([...view.askingLeads, ...reviewing])];
  const helped = running.length > 0;
  const idle = view.leads.filter(lead => !running.includes(lead));
  const backlog = !helped && idle.length > 0 && waiting.length >= 2 && (waiting[0]?.waited ?? 0) >= REVIEW_BACKLOG_MS;

  return [
    ...(backlog
      ? [
          {
            key: `leads-needed:${waiting[0].task.id}:${String(waiting[0].task.round)}`,
            text: `${String(waiting.length)} reviews wait, the oldest (${waiting[0].task.id}) ${minutes(waiting[0].waited)} min: start a lead that reviews beside you — ${commandAs(view.scratch, idle[0], view.identified, 'task next --role lead --follow --take')} — it stops by itself once the queue is empty`
          }
        ]
      : []),
    // One a designer is still to look at is not the lead's yet: it wakes the lead once the designer said.
    ...view.tasks
      .filter(task => task.status === 'in-review' && task.design?.status !== 'due')
      // One another lead took is theirs: the lead is not woken for it.
      .filter(task => task.reviewer === undefined || !view.leads.includes(task.reviewer))
      .filter(
        task =>
          !helped ||
          (task.reviewer === undefined && now.getTime() - Date.parse(task.since ?? view.openedAt) >= UNTAKEN_REVIEW_MS)
      )
      .map(task => ({
        key: `review:${task.id}:${String(task.round)}:${task.takenAt ?? ''}:${task.design?.status ?? ''}`,
        text: helped
          ? `${task.id} has waited in review ${minutes(now.getTime() - Date.parse(task.since ?? view.openedAt))} min and no lead took it (${running.join(', ')} at a review): review it yourself — plitzi task look ${task.id}, then plitzi task review ${task.id} --approve | --changes "…"`
          : task.design?.status === 'approved'
            ? `${task.id} is in review, its UI approved by ${task.design.by ?? 'a designer'} — yours is the final review: plitzi task look ${task.id}, then plitzi task review ${task.id} --approve | --changes "…"`
            : `${task.id} is in review: plitzi task review ${task.id} --approve | --changes "…"`
      })),
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
};

/**
 * With the team's `options.launch`, the agents the run asks for are started here, not woken for: each `agents-needed`
 * notice names its agent, and it is launched as `run agent --launch` would — refused while it still runs, resuming
 * its session when the team asks it. What could not start is said to the lead, with why.
 */
const launchAsked = async (
  ctx: RunContext,
  runId: string,
  view: RunView
): Promise<{ started: string[]; failed: LeadItem[] }> => {
  const harness = (await readTeam(ctx.root).catch(() => undefined))?.options?.launch;
  const asked = [
    ...new Set(view.attention.flatMap(item => (item.kind === 'agents-needed' && item.agent ? [item.agent] : [])))
  ];
  if (harness === undefined || asked.length === 0) {
    return { started: [], failed: [] };
  }

  const started: string[] = [];
  const failed: LeadItem[] = [];
  for (const agent of asked) {
    try {
      await launchAgent(ctx, runId, agent, await harnessOf(harness));
      started.push(agent);
    } catch (error) {
      if (!isRunRefusal(error)) {
        throw error;
      }

      failed.push({
        key: `launch-failed:${agent}:${error.message}`,
        text: `${agent} could not be started in ${harness} (options.launch): ${error.message} — start it yourself, plitzi run agent ${agent} --launch --harness <yours>`
      });
    }
  }

  return { started, failed };
};

const isKeys = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(each => typeof each === 'string');

export const waitForLead = async (
  ctx: RunContext,
  runId: string,
  { timeoutMs = FOLLOW_MS, everyMs = 10_000 } = {}
): Promise<LeadNews> => {
  const started = Date.now();
  for (;;) {
    let view: RunView;
    let seenFile: string;
    let failedLaunches: LeadItem[] = [];
    try {
      seenFile = (await loadRun(ctx, runId, { anyMachine: true, anyVersion: true })).paths.leadSeen;
      view = await viewRun(ctx, runId);
      const launched = await launchAsked(ctx, runId, view);
      failedLaunches = launched.failed;
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
    const fresh = [...failedLaunches, ...leadItems(view, ctx.now())].filter(item => !seen.has(item.key));
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
