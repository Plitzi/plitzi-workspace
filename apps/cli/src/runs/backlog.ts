import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readJson, writeJson } from './files';
import { noticesOf } from './notices';
import { RunRefusal } from './refusal';

import type { LoadedRun, RunContext } from './run';

/**
 * The project's backlog: what a run noticed and left — `run notice` while it ran — kept past the run, in `.plitzi/`
 * beside the team, for the next run to take up. A run's log goes with the run, and a report is read by nobody planning
 * the next one: velada-polish's lead had the next run's work in its head and its notes, and nowhere the next run reads.
 * `run plan` and `run open` say what is open; `run backlog` lists it, `run backlog done <id>` closes an item.
 */

export const BACKLOG_FILE = path.join('.plitzi', 'backlog.json');

export interface BacklogItem {
  id: string;
  text: string;
  /** Where it is: a page, an element, a file. */
  on?: string;
  /** The run that noticed it, and who. */
  from: string;
  by: string;
  at: string;
  /** Closed: when, by whom, and how — a run that did it, or why it is no longer wanted. */
  done?: { at: string; by: string; note?: string };
}

interface Backlog {
  version: 1;
  items: BacklogItem[];
}

const isItem = (value: unknown): value is BacklogItem =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.text === 'string' &&
  typeof value.from === 'string' &&
  typeof value.by === 'string' &&
  typeof value.at === 'string';

const isBacklog = (value: unknown): value is Backlog =>
  isRecord(value) && value.version === 1 && Array.isArray(value.items) && value.items.every(isItem);

export const readBacklog = async (root: string): Promise<BacklogItem[]> =>
  (await readJson(path.join(root, BACKLOG_FILE), isBacklog, 'the project’s backlog'))?.items ?? [];

/** What is open in the project's backlog: what no run did yet. */
export const openBacklog = async (root: string): Promise<BacklogItem[]> =>
  (await readBacklog(root)).filter(item => item.done === undefined);

/**
 * A run's notices, kept in the project's backlog as it ends — finished or aborted: what it saw and left is the next
 * run's. One already there (the same words, the same place) is not kept twice. Answers the items it added.
 */
export const keepNotices = async (ctx: RunContext, loaded: LoadedRun): Promise<BacklogItem[]> => {
  const items = await readBacklog(ctx.root);
  const known = new Set(items.map(item => `${item.text}\u0000${item.on ?? ''}`));
  const next = items.length === 0 ? 1 : Math.max(...items.map(item => Number(item.id.replace(/^b-/, '')) || 0)) + 1;
  const added = (await noticesOf(loaded))
    .filter(notice => !known.has(`${notice.text}\u0000${notice.on ?? ''}`))
    .map((notice, index): BacklogItem => ({
      id: `b-${String(next + index)}`,
      text: notice.text,
      ...(notice.on ? { on: notice.on } : {}),
      from: loaded.record.runId,
      by: notice.by,
      at: notice.at
    }));
  if (added.length > 0) {
    await writeJson(path.join(ctx.root, BACKLOG_FILE), { version: 1, items: [...items, ...added] } satisfies Backlog);
  }

  return added;
};

/** `plitzi run backlog done <id>`: an item closed, saying how — no item is closed silently. */
export const closeBacklogItem = async (ctx: RunContext, id: string, note?: string): Promise<BacklogItem> => {
  const items = await readBacklog(ctx.root);
  const item = items.find(each => each.id === id);
  if (!item) {
    throw new RunRefusal(
      'not-found',
      `The backlog has no "${id}": ${
        items
          .filter(each => !each.done)
          .map(each => each.id)
          .join(', ') || 'nothing is open'
      }`
    );
  }

  if (item.done) {
    throw new RunRefusal('invalid', `${id} was closed already, at ${item.done.at} by ${item.done.by}`);
  }

  const closed: BacklogItem = {
    ...item,
    done: { at: ctx.now().toISOString(), by: ctx.agent, ...(note ? { note } : {}) }
  };
  await writeJson(path.join(ctx.root, BACKLOG_FILE), {
    version: 1,
    items: items.map(each => (each.id === id ? closed : each))
  } satisfies Backlog);

  return closed;
};

/** An item as a line: its id, where, what. */
export const backlogText = (item: BacklogItem): string =>
  `${item.id}${item.on ? ` (${item.on})` : ''}: ${item.text} — ${item.from}, ${item.by}`;
