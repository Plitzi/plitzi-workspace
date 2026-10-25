import { proposalsOf } from './agreements';
import { fingerprint, readOptional } from './files';
import { LARGE_OUTPUT } from './findings/cost';
import { isCoLead, isPrincipal } from './leads';
import { LEAD, markRead, messagesOf } from './messages';
import { under } from './paths';
import { RunRefusal } from './refusal';
import { loadRun, readApproved, readBase } from './run';
import { getBlob } from './store';
import { notReviewedIn } from './tasks';
import { requestsShown } from './tasks/context';
import { readStart, viewTask } from './taskStore';
import { unifiedDiff } from '../fix/diff';

import type { ProposalView } from './agreements';
import type { Message } from './messages';
import type { AcceptanceResult, DesignReview, KnownFailure, RunTask, TaskStatus } from './model';
import type { LoadedRun, RunContext } from './run';

/**
 * `plitzi task show`: one task as its lead reviews it — what it was asked, what it changed (each file's diff against
 * where its copy started), whether its checks passed, what it agreed with others, what was said, and what to run next.
 * Read only: what a lead used to piece together from `task context`'s JSON, the copy and the run's folder.
 */

/** How many lines of one file's diff it shows: past them, how many are left. */
const DIFF_LINES = 80;

/**
 * How many lines of diff it shows in all: past them, each file left says its size and how to read it. A run's
 * `task show` answered up to 44k characters — eighteen files of eighty lines — and the reviewers read it 77 times;
 * A run's, at 400 lines, up to 24k, 46 times over 12k: a review reads the rest a file at a time.
 */
const DIFF_TOTAL = 240;

export interface ShownFile {
  file: string;
  /** Whether the copy adds it, changes it or removes it. */
  change: 'added' | 'changed' | 'removed';
  diff?: string;
  /** Lines of the diff past the ones shown. */
  more?: number;
  /** Lines of its diff not shown at all: the files before it took the lines a show gives. */
  withheld?: number;
  /** Not text, or too large to diff. */
  binary?: boolean;
}

export interface TaskShown {
  task: RunTask;
  status: TaskStatus;
  round: number;
  holder?: string;
  /**
   * Where its changes are read from: as it went to review while it is in review — what an approval merges — its copy
   * while it otherwise has one, else what the run approved.
   */
  from: 'submitted' | 'copy' | 'run' | 'none';
  /** In review, what its copy holds that did not go to review: shown as not part of it. */
  notReviewed?: string[];
  files: ShownFile[];
  /** What `complete` found: passed, or a failure it went to review with and who fixes it. */
  checks: 'passed' | 'not-run' | { knownFailure: KnownFailure };
  /** Its acceptance's checks at its last `complete`. */
  accepted?: AcceptanceResult[];
  /** What its checks passed with but still warned of. */
  warnings?: string[];
  notes: { at: string; by: string; text: string }[];
  agreements: ProposalView[];
  unanswered: ProposalView[];
  /** What it asked of shared files — an integration task's, what it applies — each with what it changes. */
  requests: { task: string; file: string; summary: string; diff?: string }[];
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

/**
 * Where a task's changes are read from (`TaskShown['from']`), and each file's two versions: where its work started, and
 * what it holds there — what the diff of `task show` is between, and what `task show <task> <file>` prints whole.
 */
const versionsOf = async (loaded: LoadedRun, root: string, task: RunTask) => {
  const view = await viewTask(loaded.paths, task);
  // A copy is read only while someone holds the task: a cut task's is left behind, never to be merged.
  const start = view.owner ? await readStart(view.paths) : undefined;
  const approved = (await readApproved(loaded.paths)).files;
  const changed = view.state.changed ?? [];
  const submitted = view.state.status === 'in-review' ? view.state.submitted : undefined;
  const from: TaskShown['from'] = submitted ? 'submitted' : start ? 'copy' : changed.length > 0 ? 'run' : 'none';
  // Without a copy, what it changed is read against what the run started from: the project as the run copied it.
  const base = start ? undefined : (await readBase(loaded.paths)).files;
  const versions = async (file: string): Promise<{ before?: Buffer; after?: Buffer }> => {
    const before = await versionOf(
      loaded,
      root,
      file,
      start ? start.files[file] : base && Object.hasOwn(base, file) ? base[file] : undefined
    );
    const after = submitted
      ? await versionOf(loaded, root, file, Object.hasOwn(submitted, file) ? submitted[file] : undefined)
      : from === 'copy'
        ? await readOptional(under(view.paths.work, file))
        : await versionOf(loaded, root, file, Object.hasOwn(approved, file) ? approved[file].digest : undefined);

    return { ...(before ? { before } : {}), ...(after ? { after } : {}) };
  };

  return { view, changed, submitted, from, versions };
};

/** How each source a task's files are read from is said. */
export const FROM_TEXT: Record<TaskShown['from'], string> = {
  submitted: 'as it went to review',
  copy: 'its copy',
  run: 'as approved',
  none: 'nothing yet'
};

/**
 * What an agent of the team does with another's task: tells the lead, or asks that task to agree to a change — never
 * the lead's steps, which refuse its token (a run's design-2 was offered `task message`).
 */
const agentNext = (task: RunTask): string[] => [
  `plitzi task tell --about ${task.id} "…"   # what the lead should know of it`,
  `plitzi task propose ${task.id} --change "…"   # a change you need it to agree to`
];

const nextFor = (task: RunTask, status: TaskStatus, design?: DesignReview): string[] => {
  switch (status) {
    case 'in-review':
      return [
        ...(design?.status === 'due'
          ? [
              `# its UI waits for ${design.by ?? 'a designer'}'s review: the lead approves after it, or now with plitzi task review ${task.id} --approve --skip-design lead`
            ]
          : []),
        `plitzi task look ${task.id}   # its pages as it went to review: checked at 1440 and 390, pictured light and dark`,
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

export const showTask = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  { full = false }: { full?: boolean } = {}
): Promise<TaskShown> => {
  // Read only, for anyone in the run: what another task changed or asks of a shared file is what an agent builds on —
  // A run's agents were refused another task's and diffed its blobs by hash to read a request.
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const task = loaded.tasks.find(each => each.id === taskId);
  if (!task) {
    throw new RunRefusal('not-found', `Run "${runId}" has no task "${taskId}"`, { task: taskId });
  }

  const { view, changed, submitted, from, versions } = await versionsOf(loaded, ctx.root, task);
  const files: ShownFile[] = [];
  let left = DIFF_TOTAL;
  let fullLeft = LARGE_OUTPUT;
  for (const file of changed) {
    const { before, after } = await versions(file);
    const change: ShownFile['change'] =
      before === undefined && after !== undefined ? 'added' : after === undefined ? 'removed' : 'changed';
    const a = textOf(before) ?? (before === undefined ? '' : undefined);
    const b = textOf(after) ?? (after === undefined ? '' : undefined);
    if (a === undefined || b === undefined) {
      files.push({ file, change, binary: true });
      continue;
    }

    const lines = unifiedDiff(file, a, b).split('\n');
    // Whole, every file — as long as the answer stays one an agent reads again cheaply: a run's `--full` answered 34k
    // characters, read again on every turn after. A file past it says its size and how to read it alone.
    const size = lines.join('\n').length;
    if (full ? fullLeft < size && files.some(each => each.diff !== undefined) : left <= 0) {
      files.push({ file, change, withheld: lines.length });
      continue;
    }

    fullLeft -= size;

    const shown = full ? lines.length : Math.min(DIFF_LINES, left);
    left -= shown;
    files.push({
      file,
      change,
      diff: lines.slice(0, shown).join('\n'),
      ...(lines.length > shown ? { more: lines.length - shown } : {})
    });
  }

  const proposals = await proposalsOf(loaded);
  const mine = proposals.filter(each => each.from === taskId || each.to === taskId);
  const { knownFailure } = view.state;

  const said = (await messagesOf(loaded)).filter(each => each.to === taskId || each.from === taskId);
  // The lead reads what this task told it here — a question stays until it is answered: `run watch` and the
  // inbox do not hand it over again.
  await markRead(
    loaded,
    LEAD,
    said
      .filter(each => each.to === LEAD && each.fyi === true)
      .slice(-6)
      .map(each => each.id)
  );

  const notReviewed = submitted ? await notReviewedIn(ctx, runId, taskId) : [];

  return {
    task,
    status: view.state.status,
    round: view.state.round,
    ...(view.owner ? { holder: view.owner.agent } : {}),
    from,
    files,
    ...(notReviewed.length > 0 ? { notReviewed } : {}),
    checks: knownFailure ? { knownFailure } : changed.length > 0 ? 'passed' : 'not-run',
    ...(view.state.accepted ? { accepted: view.state.accepted } : {}),
    ...(view.state.warnings ? { warnings: view.state.warnings } : {}),
    notes: view.state.notes.slice(-6),
    agreements: mine.filter(each => each.answer?.verdict === 'accept'),
    unanswered: mine.filter(each => each.answer === undefined),
    requests: (await requestsShown(ctx, loaded, task, view)).map(each => ({
      task: each.task,
      file: each.file,
      summary: each.summary,
      ...(each.diff ? { diff: each.diff } : {})
    })),
    messages: said.slice(-6),
    next:
      isPrincipal(ctx.agent) || isCoLead(loaded.record, ctx.agent)
        ? nextFor(task, view.state.status, view.state.design)
        : agentNext(task)
  };
};

export interface TaskFileShown {
  task: string;
  file: string;
  from: TaskShown['from'];
  change: ShownFile['change'];
  /** The file whole, as the task holds it; none for one it removes, or one that is not text. */
  text?: string;
  /** Its whole diff, from where the task's work started: the task's own change, never another's approved since. */
  diff?: string;
  binary?: boolean;
}

/**
 * One file of a task whole, read from where `task show` reads its diff — as it went to review, its copy, or as
 * approved: what a reviewer reads past the 80 lines of a diff, or around a change, without going into the copy.
 */
export const showTaskFile = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  file: string
): Promise<TaskFileShown> => {
  // Read only, for anyone in the run: what another task changed or asks of a shared file is what an agent builds on —
  // A run's agents were refused another task's and diffed its blobs by hash to read a request.
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const task = loaded.tasks.find(each => each.id === taskId);
  if (!task) {
    throw new RunRefusal('not-found', `Run "${runId}" has no task "${taskId}"`, { task: taskId });
  }

  const { changed, from, versions } = await versionsOf(loaded, ctx.root, task);
  const named = file.replace(/^\.\//, '');
  if (!changed.includes(named)) {
    throw new RunRefusal(
      'not-found',
      changed.length === 0
        ? `${taskId} changed no file yet: there is nothing of it to show`
        : `${taskId} did not change ${named}: its changed files are ${changed.join(', ')}`,
      {
        task: taskId,
        next:
          changed.length === 0
            ? `plitzi task show ${taskId} says what it changes, once it has completed or its copy has some`
            : `name one of its changed files, as written there — or read ${named} in the project, which the task left as it was`
      }
    );
  }

  const { before, after } = await versions(named);
  const change: ShownFile['change'] =
    before === undefined && after !== undefined ? 'added' : after === undefined ? 'removed' : 'changed';
  const text = textOf(after);
  const was = textOf(before) ?? (before === undefined ? '' : undefined);
  const now = text ?? (after === undefined ? '' : undefined);

  return {
    task: taskId,
    file: named,
    from,
    change,
    ...(text === undefined ? {} : { text }),
    ...(was !== undefined && now !== undefined ? { diff: unifiedDiff(named, was, now) } : {}),
    ...(after !== undefined && text === undefined ? { binary: true } : {})
  };
};
