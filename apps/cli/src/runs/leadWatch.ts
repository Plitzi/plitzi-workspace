import { readJson, writeJson } from './files';
import { FOLLOW_MS } from '../options';
import { REVIEW_BACKLOG_MS, UNTAKEN_REVIEW_MS } from './leads';
import { isRunRefusal } from './refusal';
import { loadRun } from './run';
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
}

export interface LeadNews {
  fresh: LeadItem[];
  view?: RunView;
  /** The run finished or was aborted while it waited. */
  gone?: true;
  /** Nothing new within the time it was given. */
  timedOut?: true;
}

// What says how long something has lasted changes its words every minute: it is the same notice all the same.
const TIMED = new Set<Attention['kind']>(['no-signal', 'long-wait', 'long-task', 'stopping']);

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
            text: `${String(waiting.length)} reviews wait, the oldest (${waiting[0].task.id}) ${minutes(waiting[0].waited)} min: start a lead that reviews beside you — plitzi task next --role lead --follow --take --agent ${idle[0]} — it stops by itself once the queue is empty`
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
          : item.file === undefined
            ? `${item.kind}:${item.task ?? ''}:${item.text}`
            : `${item.kind}:${item.task ?? ''}:${item.file}`,
        text: item.text
      }))
  ];
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
    try {
      seenFile = (await loadRun(ctx, runId, { anyMachine: true, anyVersion: true })).paths.leadSeen;
      view = await viewRun(ctx, runId);
    } catch (error) {
      if (isRunRefusal(error) && error.code === 'not-found') {
        return { fresh: [], gone: true };
      }

      throw error;
    }

    const seen = new Set((await readJson(seenFile, isKeys, 'what the lead was woken for')) ?? []);
    const fresh = leadItems(view, ctx.now()).filter(item => !seen.has(item.key));
    if (fresh.length > 0) {
      await writeJson(seenFile, [...seen, ...fresh.map(item => item.key)]);

      return { fresh, view };
    }

    if (Date.now() - started >= timeoutMs) {
      return { fresh: [], view, timedOut: true };
    }

    await new Promise(resolve => setTimeout(resolve, everyMs));
  }
};
