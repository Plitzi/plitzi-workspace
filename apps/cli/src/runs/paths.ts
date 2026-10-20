import path from 'node:path';

import {
  ACTIVE_RUN_FILE,
  BUILD_DIR,
  PROJECT_STATE,
  PROJECT_TMP,
  PUBLIC_DIR,
  RUNS_DIR,
  VENDOR_PLUGINS_DIR
} from '../scaffold/paths';

/**
 * Where a run keeps what it owns: under the project's `tmp/`, which the project already keeps out of git, the lint, the
 * formatter and the server's watch — so no copy of a task is ever linted, committed or served.
 *
 * Two halves. The essentials — the plan, the run's record, every version it keeps (`blobs/`, by fingerprint: the
 * backups, the approved work, each reviewed version and request) and each task's state — are never purged while the run
 * exists: with no git, they are the only way back. The caches — each task's working copy, progress and log, the run's
 * materialised copy — are rebuilt from them.
 */
export { RUNS_DIR };

/** A run's id or a task's: what a folder can be named on every system, and a person can type. */
export const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** What a task's copy leaves out: what is not the project's source, and what an agent must never read. */
export const NOT_COPIED_DIRS = new Set([
  'node_modules',
  '.git',
  '.plitzi',
  '.yarn',
  PROJECT_TMP,
  BUILD_DIR,
  PROJECT_STATE
]);

/** What a `.env` that holds no value is called: the committed list of what to fill in. */
const ENV_TEMPLATE = /(^|\/)\.env\.(example|sample|template|dist)$/;

/** Credentials — `.env`, `.env.local`, `.env.production`… — never copied, never in a task's files; their templates are. */
export const isSecretFile = (file: string): boolean => /(^|\/)\.env(\..*)?$/.test(file) && !ENV_TEMPLATE.test(file);

/** Folders served as they came, whose bytes no check reads: their binaries are copied only for the task that owns them. */
export const SERVED_DIRS = [PUBLIC_DIR, VENDOR_PLUGINS_DIR.split('/')[0]];

export interface RunPaths {
  root: string;
  dir: string;
  plan: string;
  record: string;
  mergeLock: string;
  /** One take at a time: the run's agent limit is counted and kept under it. */
  takeLock: string;
  /**
   * One claim at a time: a file's locks live in each task's folder, so whether anyone holds it and taking it are one
   * step only under this — two tasks completing at once never both take a shared file by turns.
   */
  claimLock: string;
  blobs: string;
  base: string;
  approved: string;
  shared: string;
  merges: string;
  log: string;
  /** The lead's summary of the run, for its report. */
  summary: string;
  /** The lead's primer, as the run keeps it: every task's brief starts with it. */
  primer: string;
  /** Messages between the lead and the tasks, one a file. */
  messages: string;
  /** Which of them the lead has read. */
  leadRead: string;
  /** What `run watch --until lead` already woke the lead for. */
  leadSeen: string;
  /** When each lead that reviews last asked for a review (`task next --role lead`): which of them are running. */
  leadsAsking: string;
  cache: string;
  materialised: string;
}

export const runsDir = (root: string): string => path.join(root, RUNS_DIR);

/** Where `--keep-backup` leaves what the final merge overwrote: out of the run, which goes, and out of git. */
export const BACKUPS_DIR = `${PROJECT_TMP}/plitzi-backups`;

/** Where a run's report is left when it ends: out of the run, which goes, and out of git. */
export const REPORTS_DIR = `${PROJECT_TMP}/plitzi-reports`;

/** The project's one run, named: created exclusively when a run opens, gone with it — so two never open at once. */
export const activeRunFile = (root: string): string => path.join(root, ACTIVE_RUN_FILE);

export const runPaths = (root: string, runId: string): RunPaths => {
  const dir = path.join(runsDir(root), runId);
  const cache = path.join(dir, 'cache');

  return {
    root,
    dir,
    plan: path.join(dir, 'plan.json'),
    record: path.join(dir, 'run.json'),
    mergeLock: path.join(dir, 'merge.lock'),
    takeLock: path.join(dir, 'take.lock'),
    claimLock: path.join(dir, 'claim.lock'),
    blobs: path.join(dir, 'blobs'),
    base: path.join(dir, 'base.json'),
    approved: path.join(dir, 'approved.json'),
    shared: path.join(dir, 'shared.json'),
    merges: path.join(dir, 'merges'),
    log: path.join(dir, 'log.jsonl'),
    summary: path.join(dir, 'summary.md'),
    primer: path.join(dir, 'primer.md'),
    messages: path.join(dir, 'messages'),
    leadRead: path.join(dir, 'lead-read.json'),
    leadSeen: path.join(dir, 'lead-seen.json'),
    leadsAsking: path.join(dir, 'leads-asking.json'),
    cache,
    materialised: path.join(cache, 'run')
  };
};

export interface TaskPaths {
  dir: string;
  definition: string;
  state: string;
  stateLock: string;
  owner: string;
  /** The fingerprints of the tokens it was taken with and lost: a cut token is told apart from one never its. */
  revoked: string;
  locks: string;
  requests: string;
  proposals: string;
  answers: string;
  /** Which messages to it it has read. */
  read: string;
  review: string;
  /** Held while a verdict is given: two leads saying one at once, one waits and reads it said. */
  reviewLock: string;
  reviewed: string;
  cache: string;
  work: string;
  start: string;
  progress: string;
  log: string;
}

export const tasksDir = (run: RunPaths): string => path.join(run.dir, 'tasks');

export const taskPaths = (run: RunPaths, taskId: string): TaskPaths => {
  const dir = path.join(tasksDir(run), taskId);
  const cache = path.join(dir, 'cache');

  return {
    dir,
    definition: path.join(dir, 'task.json'),
    state: path.join(dir, 'state.json'),
    stateLock: path.join(dir, 'state.lock'),
    owner: path.join(dir, 'owner.json'),
    revoked: path.join(dir, 'revoked.json'),
    locks: path.join(dir, 'locks'),
    requests: path.join(dir, 'requests'),
    proposals: path.join(dir, 'proposals'),
    answers: path.join(dir, 'answers'),
    read: path.join(dir, 'read.json'),
    review: path.join(dir, 'review.json'),
    reviewLock: path.join(dir, 'review.lock'),
    reviewed: path.join(dir, 'reviewed.json'),
    cache,
    work: path.join(cache, 'work'),
    start: path.join(cache, 'start.json'),
    progress: path.join(cache, 'progress.json'),
    log: path.join(cache, 'log.jsonl')
  };
};

/** A task's `.lock` for a project file: at the same path under its `locks/`, as an editor leaves one beside a file. */
export const lockFile = (task: TaskPaths, file: string): string => under(task.locks, `${file}.lock`);

/** A project path as the run writes it everywhere: relative, with forward slashes whatever the system writes. */
export const projectPath = (root: string, file: string): string =>
  path.relative(root, path.resolve(root, file)).split(path.sep).join('/');

/** Where a project path is under another folder that mirrors the project (a copy, a backup). */
export const under = (folder: string, file: string): string => path.join(folder, ...file.split('/'));

/**
 * Where a task's copy keeps who it is — its run, its task, its token, its agent — so a command run inside the copy needs
 * none of them said. In the copy's `tmp/`, which never counts at `complete` and is never copied back.
 */
export const COPY_TASK_FILE = 'tmp/plitzi-task.json';
