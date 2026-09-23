import { describeChange, fieldChanges, uniqueLines } from '@plitzi/sdk-shared/history';

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

/** Whether a revision was published after a change: by the change it reaches when that is known, by date otherwise. */
const publishedAfter = (snapshot: TSnapshotMarker, change: ChangeRecord): boolean =>
  snapshot.upToSeq !== null ? snapshot.upToSeq >= change.seq : snapshot.publishedAt >= change.at;

/**
 * Each published revision drawn right above the last change it includes — so what sits below a marker is in that
 * revision, and what sits above is not. A revision older than everything loaded waits for the page that reaches it,
 * unless the timeline is over.
 */
export const placeSnapshots = (
  groups: ChangeGroup[],
  snapshots: TSnapshotMarker[],
  complete: boolean
): TimelineRow[] => {
  const pending = [...snapshots].sort((a, b) => b.publishedAt - a.publishedAt);
  const rows: TimelineRow[] = [];
  for (const group of groups) {
    while (pending.length > 0 && publishedAfter(pending[0], group.changes[0])) {
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

const CLOCK = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

/** Just the time of day, for a save listed under a row that already says the date. */
export const formatClock = (at: number): string => CLOCK.format(new Date(at));

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

/** What a row of saves did, each thing on its own line and said once — ten keystrokes in one text are one line. */
export const groupLines = (group: ChangeGroup) =>
  uniqueLines(group.changes.flatMap(change => describeChange(change.entries)));

/** How many lines a folded row shows before it says how many more there are. */
export const FOLDED_LINES = 5;

/**
 * Fields that are the tree rather than the element: a parent's list of children, a child's parent and root. They are
 * said by the lines about adds, removals and moves, so the detail leaves them out — or a page would read as changed
 * every time something is added to it.
 */
const TREE_PATHS = new Set(['definition.items', 'definition.parentId', 'definition.rootId']);

/** What the detail of an entry shows: the fields that changed, less the tree. */
export const detailOf = (entry: ChangeEntry) =>
  entry.op === 'update' ? fieldChanges(entry.before, entry.after).filter(({ path }) => !TREE_PATHS.has(path)) : [];

/**
 * The entries a save's detail lists: what was edited in more than its place in the tree. An add, a removal or a move is
 * already its line, and the line is the link to the element.
 */
export const detailedEntries = (entries: ChangeEntry[]): ChangeEntry[] =>
  entries.filter(entry => detailOf(entry).length > 0);

/** A published revision, as its marker names it, and how far into the timeline it reaches. */
export const snapshotLabel = ({ revision, environment, description, upToSeq }: TSnapshotMarker): string =>
  [
    `Revision ${revision}`,
    environment !== 'main' ? environment : '',
    description ? `“${description}”` : '',
    upToSeq !== null ? `includes up to #${upToSeq}` : 'published before this history'
  ]
    .filter(Boolean)
    .join(' · ');

/** The changes a row covers, by number: `#50`, or `#48–50` for several saves. */
export const groupRange = (group: ChangeGroup): string => {
  const newest = group.changes[0].seq;
  const oldest = group.changes[group.changes.length - 1].seq;

  return oldest === newest ? `#${newest}` : `#${oldest}–${newest}`;
};

export const rowKey = (row: TimelineRow): string =>
  row.type === 'group' ? `change-${row.group.key}` : `snapshot-${row.snapshot.environment}-${row.snapshot.revision}`;
