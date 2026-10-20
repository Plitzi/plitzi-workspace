import { proposalsOf } from './agreements';
import { fingerprint, readOptional } from './files';
import { messagesOf } from './messages';
import { under } from './paths';
import { RunRefusal } from './refusal';
import { loadRun, readApproved, readBase, requireNoTask } from './run';
import { getBlob } from './store';
import { readRequests, readStart, viewTask } from './taskStore';
import { unifiedDiff } from '../fix/diff';

import type { ProposalView } from './agreements';
import type { Message } from './messages';
import type { AcceptanceResult, KnownFailure, RunTask, TaskStatus } from './model';
import type { LoadedRun, RunContext } from './run';

/**
 * `plitzi task show`: one task as its lead reviews it — what it was asked, what it changed (each file's diff against
 * where its copy started), whether its checks passed, what it agreed with others, what was said, and what to run next.
 * Read only: what a lead used to piece together from `task context`'s JSON, the copy and the run's folder.
 */

/** How many lines of one file's diff it shows: past them, how many are left. */
const DIFF_LINES = 80;

export interface ShownFile {
  file: string;
  /** Whether the copy adds it, changes it or removes it. */
  change: 'added' | 'changed' | 'removed';
  diff?: string;
  /** Lines of the diff past the ones shown. */
  more?: number;
  /** Not text, or too large to diff. */
  binary?: boolean;
}

export interface TaskShown {
  task: RunTask;
  status: TaskStatus;
  round: number;
  holder?: string;
  /** Where its changes are read from: its copy while it has one, else what the run approved. */
  from: 'copy' | 'run' | 'none';
  files: ShownFile[];
  /** What `complete` found: passed, or a failure it went to review with and who fixes it. */
  checks: 'passed' | 'not-run' | { knownFailure: KnownFailure };
  /** Its acceptance's checks at its last `complete`. */
  accepted?: AcceptanceResult[];
  notes: { at: string; by: string; text: string }[];
  agreements: ProposalView[];
  unanswered: ProposalView[];
  requests: { file: string; summary: string }[];
  messages: Message[];
  /** The commands that act on it from where it stands. */
  next: string[];
}

const MAX_TEXT = 256 * 1024;

const textOf = (bytes: Buffer | undefined): string | undefined =>
  bytes === undefined || bytes.length > MAX_TEXT || bytes.includes(0) ? undefined : bytes.toString('utf-8');

const versionOf = async (loaded: LoadedRun, root: string, file: string, digest: string | null | undefined) => {
  if (digest === null || digest === undefined) {
    return undefined;
  }

  // The run keeps what its tasks start from; a file nobody kept is read from the project, as the copy was made from it.
  return getBlob(loaded.paths, digest).catch(async () => {
    const bytes = await readOptional(under(root, file));

    return bytes !== undefined && (await fingerprint(under(root, file))) === digest ? bytes : undefined;
  });
};

const nextFor = (task: RunTask, status: TaskStatus): string[] => {
  switch (status) {
    case 'in-review':
      return [
        `plitzi run preview --task ${task.id}   # its pages as it went to review`,
        `plitzi task review ${task.id} --approve`,
        `plitzi task review ${task.id} --changes "what to change" [--on <element>]`
      ];
    case 'blocked':
      return [`plitzi task unblock ${task.id} --answer "what it waited for"`];
    case 'in-progress':
    case 'changes-requested':
      return [`plitzi task message ${task.id} "…"`, `plitzi task reassign ${task.id}   # when its agent is gone`];
    case 'done':
      return [`plitzi task revert ${task.id}   # takes its work out of the run, before the final merge`];
    default:
      return [];
  }
};

export const showTask = async (ctx: RunContext, runId: string, taskId: string): Promise<TaskShown> => {
  requireNoTask(ctx, 'show a task as its lead');
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const task = loaded.tasks.find(each => each.id === taskId);
  if (!task) {
    throw new RunRefusal('not-found', `Run "${runId}" has no task "${taskId}"`, { task: taskId });
  }

  const view = await viewTask(loaded.paths, task);
  // A copy is read only while someone holds the task: a cut task's is left behind, never to be merged.
  const start = view.owner ? await readStart(view.paths) : undefined;
  const approved = (await readApproved(loaded.paths)).files;
  const changed = view.state.changed ?? [];
  const from: TaskShown['from'] = start ? 'copy' : changed.length > 0 ? 'run' : 'none';
  const files: ShownFile[] = [];
  // Without a copy, what it changed is read against what the run started from: the project as the run copied it.
  const base = start ? undefined : (await readBase(loaded.paths)).files;
  for (const file of changed) {
    const before = await versionOf(
      loaded,
      ctx.root,
      file,
      start ? start.files[file] : base && Object.hasOwn(base, file) ? base[file] : undefined
    );
    const after =
      from === 'copy'
        ? await readOptional(under(view.paths.work, file))
        : await versionOf(loaded, ctx.root, file, Object.hasOwn(approved, file) ? approved[file].digest : undefined);
    const change: ShownFile['change'] =
      before === undefined && after !== undefined ? 'added' : after === undefined ? 'removed' : 'changed';
    const a = textOf(before) ?? (before === undefined ? '' : undefined);
    const b = textOf(after) ?? (after === undefined ? '' : undefined);
    if (a === undefined || b === undefined) {
      files.push({ file, change, binary: true });
      continue;
    }

    const lines = unifiedDiff(file, a, b).split('\n');
    files.push({
      file,
      change,
      diff: lines.slice(0, DIFF_LINES).join('\n'),
      ...(lines.length > DIFF_LINES ? { more: lines.length - DIFF_LINES } : {})
    });
  }

  const proposals = await proposalsOf(loaded);
  const mine = proposals.filter(each => each.from === taskId || each.to === taskId);
  const { knownFailure } = view.state;

  return {
    task,
    status: view.state.status,
    round: view.state.round,
    ...(view.owner ? { holder: view.owner.agent } : {}),
    from,
    files,
    checks: knownFailure ? { knownFailure } : changed.length > 0 ? 'passed' : 'not-run',
    ...(view.state.accepted ? { accepted: view.state.accepted } : {}),
    notes: view.state.notes.slice(-6),
    agreements: mine.filter(each => each.answer?.verdict === 'accept'),
    unanswered: mine.filter(each => each.answer === undefined),
    requests: (await readRequests(view.paths)).map(each => ({ file: each.file, summary: each.summary })),
    messages: (await messagesOf(loaded)).filter(each => each.to === taskId || each.from === taskId).slice(-6),
    next: nextFor(task, view.state.status)
  };
};
