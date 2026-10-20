import { readJson, writeJson } from './files';
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

/** What needs the lead in `view`, each by a key that stays while it is the same thing — a review by its round. */
export const leadItems = (view: RunView): LeadItem[] => [
  ...view.tasks
    .filter(task => task.status === 'in-review')
    .map(task => ({
      key: `review:${task.id}:${String(task.round)}`,
      text: `${task.id} is in review: plitzi task review ${task.id} --approve | --changes "…"`
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

const isKeys = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(each => typeof each === 'string');

export const waitForLead = async (
  ctx: RunContext,
  runId: string,
  { timeoutMs = 25 * 60_000, everyMs = 10_000 } = {}
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
    const fresh = leadItems(view).filter(item => !seen.has(item.key));
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
