import { summarizeChange } from '@plitzi/sdk-shared/history';

import type { ChangeEntry, ChangeKind, ChangeOrigin, TSnapshotMarker, TSpaceChanges } from '@plitzi/sdk-shared';

export type ChangeRecord = TSpaceChanges['changes'][number];

/** Saves close enough together to read as one piece of work. A guess to revisit against real sessions (RFC 0003). */
export const GROUP_WINDOW_MS = 60_000;

/** Consecutive saves by the same author from the same place: one request, or a burst of editing. */
export type ChangeGroup = { key: string; changes: ChangeRecord[] };

const sameHands = (a: ChangeRecord, b: ChangeRecord): boolean =>
  a.origin === b.origin && a.author.userId === b.author.userId && a.client === b.client;

/**
 * The timeline as a person reads it: a builder save per keystroke is noise, so consecutive saves by the same author from
 * the same place are one row when they came from one request, or followed each other within {@link GROUP_WINDOW_MS}.
 * `changes` arrives newest first and stays that way.
 */
export const groupChanges = (changes: ChangeRecord[]): ChangeGroup[] => {
  const groups: ChangeGroup[] = [];
  for (const change of changes) {
    const current = groups.at(-1);
    const previous = current?.changes.at(-1);
    if (
      current &&
      previous &&
      sameHands(previous, change) &&
      (previous.batch === change.batch || previous.at - change.at <= GROUP_WINDOW_MS)
    ) {
      current.changes.push(change);
    } else {
      groups.push({ key: String(change.seq), changes: [change] });
    }
  }

  return groups;
};

export type TimelineRow = { type: 'group'; group: ChangeGroup } | { type: 'snapshot'; snapshot: TSnapshotMarker };

/**
 * Each published revision drawn above the changes made before its date — so what sits below a marker is what that
 * revision includes. Indicative: it is placed by date, not by any link between a revision and a change. A revision
 * older than everything loaded waits for the page that reaches it, unless the timeline is over.
 */
export const placeSnapshots = (
  groups: ChangeGroup[],
  snapshots: TSnapshotMarker[],
  complete: boolean
): TimelineRow[] => {
  const pending = [...snapshots].sort((a, b) => b.publishedAt - a.publishedAt);
  const rows: TimelineRow[] = [];
  for (const group of groups) {
    const newest = group.changes[0].at;
    while (pending.length > 0 && pending[0].publishedAt >= newest) {
      rows.push({ type: 'snapshot', snapshot: pending[0] });
      pending.shift();
    }

    rows.push({ type: 'group', group });
  }

  if (complete) {
    rows.push(...pending.map(snapshot => ({ type: 'snapshot' as const, snapshot })));
  }

  return rows;
};

export type FieldChange = { path: string; before?: unknown; after?: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What changed inside one entity, field by field (`attributes.content`, `definition.items`). Objects are walked; a list
 * or a value is compared whole, since "the third item moved" reads worse than the list before and after.
 */
export const fieldChanges = (before: unknown, after: unknown, path = ''): FieldChange[] => {
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

    return keys.flatMap(key => fieldChanges(before[key], after[key], path ? `${path}.${key}` : key));
  }

  if (JSON.stringify(before) === JSON.stringify(after)) {
    return [];
  }

  return [{ path, ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}) }];
};

const MAX_VALUE_LENGTH = 120;

/** A value as one short line: long ones are cut, since the diff is for spotting a change, not for reading a document. */
export const formatValue = (value: unknown): string => {
  if (value === undefined) {
    return 'undefined';
  }

  const text = JSON.stringify(value);

  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text;
};

export const ORIGIN_LABEL: Record<ChangeOrigin, string> = {
  builder: 'Builder',
  mcp: 'Agent',
  coworker: 'Co-worker',
  autofix: 'Autofix',
  api: 'API',
  system: 'System'
};

export const ORIGIN_TONE: Record<ChangeOrigin, string> = {
  builder: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  mcp: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  coworker: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  autofix: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  api: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  system: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
};

export const OP_TONE: Record<ChangeEntry['op'], string> = {
  add: 'text-emerald-600 dark:text-emerald-400',
  update: 'text-sky-600 dark:text-sky-400',
  remove: 'text-red-600 dark:text-red-400'
};

export const OP_ICON: Record<ChangeEntry['op'], string> = {
  add: 'fa-plus',
  update: 'fa-pen',
  remove: 'fa-minus'
};

export const MUTED = 'text-zinc-500 dark:text-zinc-400';

const TIME = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** When, in the reader's own time zone: this is a person looking back at their day, not a log line. */
export const formatTime = (at: number): string => TIME.format(new Date(at));

/** Who, as a timeline says it: the person, or the kind of writer when no person was behind it. */
export const authorLabel = (change: ChangeRecord): string => change.author.name || ORIGIN_LABEL[change.origin];

export const ORIGIN_FILTERS: ('' | ChangeOrigin)[] = ['', 'builder', 'mcp', 'coworker', 'autofix'];

/** A choice of the "made by" filter: an origin, or no filter at all. */
export const originFilterLabel = (origin: '' | ChangeOrigin): string => (origin ? ORIGIN_LABEL[origin] : 'Anyone');

export const KIND_LABEL: Record<ChangeKind, string> = {
  element: 'Element',
  folder: 'Folder',
  variable: 'Variable',
  setting: 'Setting',
  selector: 'Class',
  globalStyle: 'Global style',
  idStyle: 'Id style',
  token: 'Token',
  font: 'Font'
};

/** What a row of saves did, all of it: the entries of every save in the group, said once. */
export const groupSummary = (group: ChangeGroup): string =>
  summarizeChange(group.changes.flatMap(change => change.entries));

/** A published revision, as its marker names it. */
export const snapshotLabel = ({ revision, environment, description }: TSnapshotMarker): string =>
  [`Revision ${revision}`, environment !== 'main' ? environment : '', description ? `“${description}”` : '']
    .filter(Boolean)
    .join(' · ');

export const rowKey = (row: TimelineRow): string =>
  row.type === 'group' ? `change-${row.group.key}` : `snapshot-${row.snapshot.environment}-${row.snapshot.revision}`;
