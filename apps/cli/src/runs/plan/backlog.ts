import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { formattedJson } from '../../scaffold/formattedJson';
import { readJson, writeAtomic } from '../core/files';
import { acceptanceText } from '../core/model';
import { RunRefusal } from '../core/refusal';
import { noticesOf } from '../talk/notices';

import type { RunTask } from '../core/model';
import type { LoadedRun, RunContext } from '../run';

/**
 * The project's backlog: what a run noticed and left — `run notice` while it ran — kept past the run, in `.plitzi/`
 * beside the team, for the next run to take up. A run's log goes with the run, and a report is read by nobody planning
 * the next one: a run's lead had the next run's work in its head and its notes, and nowhere the next run reads.
 * `run open` (and its `--dry-run`) say what is open; `run backlog` lists it, `run notice "…"` keeps one with no run open
 * (the person's, or an agent's between runs), `run backlog done <id>` closes one — and a task of a plan that says it
 * does one (`closes`) closes it as its run is applied.
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

/** A backlog item's id as words name it: `b-36`. */
const ITEM_NAMED = /\bb-\d+\b/g;

/** The open items as these tasks take them up: each one a task closes, with that task, and those none does. */
export const backlogOfPlan = async (
  root: string,
  tasks: readonly {
    id: string;
    closes?: readonly string[];
    title?: string;
    spike?: string;
    findings?: string;
    files?: readonly string[];
  }[]
): Promise<{
  taken: { item: BacklogItem; task: string }[];
  /** Named by a research card — its spike, its findings: what it finds makes the tasks that close it. */
  researched: { item: BacklogItem; task: string }[];
  untaken: BacklogItem[];
}> => {
  const closer = new Map(tasks.flatMap(task => (task.closes ?? []).map(id => [id, task.id] as const)));
  // A research card names the items it looks into, in its question or its findings: listed as taken up by no task,
  // they read as left behind.
  const researcher = new Map(
    tasks
      .filter(task => task.spike !== undefined && (task.files ?? []).length === 0)
      .flatMap(
        task =>
          [task.title, task.spike, task.findings]
            .join(' ')
            .match(ITEM_NAMED)
            ?.map(id => [id, task.id] as const) ?? []
      )
      .reverse()
  );
  const open = await openBacklog(root);
  const by = (map: ReadonlyMap<string, string>) =>
    open.flatMap(item => {
      const task = map.get(item.id);

      return task === undefined ? [] : [{ item, task }];
    });

  return {
    taken: by(closer),
    researched: by(researcher).filter(each => !closer.has(each.item.id)),
    untaken: open.filter(item => !closer.has(item.id) && !researcher.has(item.id))
  };
};

/** The open items no task of these closes, by id: what the lead can stack as cards for an agent with nothing to take. */
export const stackableBacklog = async (
  root: string,
  tasks: readonly { id: string; closes?: readonly string[] }[]
): Promise<string[]> => (await backlogOfPlan(root, tasks).catch(() => ({ untaken: [] }))).untaken.map(item => item.id);

const nextId = (items: readonly BacklogItem[]): number =>
  items.length === 0 ? 1 : Math.max(...items.map(item => Number(item.id.replace(/^b-/, '')) || 0)) + 1;

// As the project's Prettier leaves it: committed beside its code, it never fails the project's format check.
const writeBacklog = (root: string, items: readonly BacklogItem[]): Promise<void> =>
  writeAtomic(path.join(root, BACKLOG_FILE), formattedJson({ version: 1, items: [...items] } satisfies Backlog));

/**
 * `plitzi run notice "…"` with no run open: an item kept — the person's, or an agent's between runs — for the next
 * plan to take up. The same words at the same place, open already, are that item: said, never kept twice.
 */
export const addBacklogItem = async (
  ctx: RunContext,
  { text, on, by }: { text: string; on?: string; by: string }
): Promise<BacklogItem> => {
  if (text.trim() === '') {
    throw new RunRefusal('invalid', 'A backlog item says something: plitzi run notice "what to do" [--on <where>]');
  }

  const items = await readBacklog(ctx.root);
  const same = items.find(item => item.done === undefined && item.text === text.trim() && item.on === on);
  if (same) {
    throw new RunRefusal('invalid', `The backlog has it open already: ${backlogText(same)}`);
  }

  const item: BacklogItem = {
    id: `b-${String(nextId(items))}`,
    text: text.trim(),
    ...(on ? { on } : {}),
    from: 'no run',
    by,
    at: ctx.now().toISOString()
  };
  await writeBacklog(ctx.root, [...items, item]);

  return item;
};

/** The ids a plan's tasks say they close that are not open in the backlog: unknown, or closed already. */
export const notOpen = async (root: string, ids: readonly string[]): Promise<string[]> => {
  const open = new Set((await openBacklog(root)).map(item => item.id));

  return [...new Set(ids)].filter(id => !open.has(id));
};

/**
 * The items an applied run's tasks said they do (`closes`), closed — each saying the task and the run that did it. Answers
 * the ids it closed; one closed meanwhile is left as it is.
 */
export const closeDoneByRun = async (ctx: RunContext, loaded: LoadedRun): Promise<string[]> => {
  const doneBy = new Map(loaded.plan.tasks.flatMap(task => (task.closes ?? []).map(id => [id, task] as const)));
  if (doneBy.size === 0) {
    return [];
  }

  const items = await readBacklog(ctx.root);
  const closed: string[] = [];
  const next = items.map(item => {
    const task = doneBy.get(item.id);
    if (!task || item.done) {
      return item;
    }

    closed.push(item.id);

    return {
      ...item,
      done: {
        at: ctx.now().toISOString(),
        by: ctx.agent,
        note: `done by run ${loaded.record.runId}'s ${task.id}: ${task.title}`
      }
    };
  });
  if (closed.length > 0) {
    await writeBacklog(ctx.root, next);
  }

  return closed;
};

/**
 * A run's notices, kept in the project's backlog as it ends — finished or aborted: what it saw and left is the next
 * run's. One already there (the same words, the same place) is not kept twice. Answers the items it added.
 */
export const keepNotices = async (ctx: RunContext, loaded: LoadedRun): Promise<BacklogItem[]> => {
  const items = await readBacklog(ctx.root);
  const known = new Set(items.map(item => `${item.text}\u0000${item.on ?? ''}`));
  const next = nextId(items);
  // Of the project's, never Plitzi's own: those go to Plitzi with the run's feedback.
  const added = (await noticesOf(loaded))
    .filter(notice => notice.about !== 'plitzi' && !known.has(`${notice.text}\u0000${notice.on ?? ''}`))
    .map((notice, index): BacklogItem => ({
      id: `b-${String(next + index)}`,
      text: notice.text,
      ...(notice.on ? { on: notice.on } : {}),
      from: loaded.record.runId,
      by: notice.by,
      at: notice.at
    }));
  if (added.length > 0) {
    await writeBacklog(ctx.root, [...items, ...added]);
  }

  return added;
};

/** `plitzi run backlog done <id>`: an item closed, saying how — no item is closed silently. */
export const closeBacklogItem = async (
  ctx: RunContext,
  id: string,
  by: string,
  note?: string
): Promise<BacklogItem> => {
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
    done: { at: ctx.now().toISOString(), by, ...(note ? { note } : {}) }
  };
  await writeBacklog(
    ctx.root,
    items.map(each => (each.id === id ? closed : each))
  );

  return closed;
};

/** An item as a line: its id, where, what. */
export const backlogText = (item: BacklogItem): string =>
  `${item.id}${item.on ? ` (${item.on})` : ''}: ${item.text} — ${item.from}, ${item.by}`;

/**
 * Each task that names an open item in its words — its title, its acceptance — and does not close it: what the task
 * does of it is left open at the apply: a task titled with an item's id did it, and the item was listed open at the
 * next run's start.
 */
export const namedNotClosed = (
  tasks: readonly Pick<RunTask, 'id' | 'title' | 'acceptance' | 'closes' | 'files' | 'spike'>[],
  open: ReadonlySet<string>
): string[] =>
  // Research names the items it looks into, and the tasks it proposes close them: a plan of research cards naming the
  // backlog was refused as leaving it open.
  tasks.flatMap(task => {
    if (task.spike !== undefined && task.files.length === 0) {
      return [];
    }

    const words = [task.title, ...task.acceptance.map(acceptanceText)].join(' ');
    const named = [...new Set(words.match(ITEM_NAMED) ?? [])].filter(
      id => open.has(id) && !(task.closes ?? []).includes(id)
    );
    const them = named.length === 1 ? 'it' : 'them';

    return named.length > 0
      ? [
          `${task.id} names ${named.join(', ')} and does not close ${them}: add ${them} to its "closes" — closed when the run is applied — or leave ${them} out of its words`
        ]
      : [];
  });
