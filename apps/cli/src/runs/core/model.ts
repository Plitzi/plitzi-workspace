import { isRecord } from '@plitzi/sdk-shared/helpers';

import { isDigest, isNumber, isSiteAddress, isString, isStrings, oneOf, optional } from './guards';
import { isBrakeEvent, isCompletions } from '../agents/brake';
import { isInventoryItem } from '../plan/inventory';
import { isFinding } from '../plan/spike';

import type { BrakeEvent } from '../agents/brake';
import type { InventoryItem } from '../plan/inventory';
import type { Finding } from '../plan/spike';
import type { ReviewState } from '../tasks/reviews';

/**
 * What each file of a run holds, with the guard every read is held to. Every time is ISO 8601 in UTC.
 * One writer per file: `plan.json` is the lead's; `run.json`, `approved/` and `merges/` are written under the
 * run's `merge.lock`; a task's `state.json` under its `state.lock`; `owner.json` is created exclusively.
 *
 * A run outlives the CLI that opened it — an upgrade while it is open — so every change to these is additive: a new
 * field is optional, and an old one keeps its meaning. `runs-compat.test.ts` works a run each released CLI wrote.
 */

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_STATUSES = [
  'pending',
  'ready',
  'in-progress',
  'waiting',
  'in-review',
  'changes-requested',
  'done',
  'blocked',
  'failed'
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** A run that finished or was aborted is gone, backups included: what is left is a run still going. */
export const RUN_STATUSES = ['open', 'stopping', 'stopped', 'reconciliation'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const NEEDS = ['person', 'lead', 'task'] as const;
/**
 * Who an agent's block waits for: the lead — the one that speaks to the person, and asks them when it must — or
 * another task. Never the person directly: nobody in the run but the lead talks to them.
 */
export const BLOCK_NEEDS = ['lead', 'task'] as const;

/**
 * How much a task asks of the model that works it: `light` — a mechanical change; `standard` — most work; `high` — what
 * many tasks build on, or what is designed new. An agent started at a level takes tasks of it or below, never above.
 */
export const QUALITIES = ['light', 'standard', 'high'] as const;
export type Quality = (typeof QUALITIES)[number];
export type Needs = (typeof NEEDS)[number];

/**
 * A line of a task's acceptance: a sentence the review weighs, or one a command proves — and the inventory's pieces it
 * proves. The command runs in the task's copy at `complete` and passes on exit 0; `$PLITZI_URL` in it is the copy
 * served, `plitzi` this CLI: `plitzi page check /walks --url $PLITZI_URL --expect walks-title~October`.
 */
export type Acceptance = string | { said: string; check: string; covers?: string[] };

/** What a line of acceptance asks, said. */
export const acceptanceText = (each: Acceptance): string => (typeof each === 'string' ? each : each.said);

/** What a line's check answered at the task's last `complete`. */
export interface AcceptanceResult {
  said: string;
  check: string;
  ok: boolean;
  /** The last lines it printed, when it failed. */
  output?: string[];
  /**
   * Passed when run again, failed the first time: the last lines it printed then. A line that asks a slow server (a CDN
   * under load) fails one run in many; one that fails twice is broken — and one that passed only the second time says
   * so, never passed in silence.
   */
  firstFailed?: string[];
  /**
   * Failed twice without an answer: its command could not read what it asks (exit 2 — the other page's element not
   * there, nothing served), or could not run at all. The line's or the machine's, not the work's: the lead is told.
   */
  unanswered?: true;
  /**
   * Amended by the lead once its task was done, and not run since: held at the finish, on the whole result, like every
   * line of a done task — when. `ok` stays false until a run says it.
   */
  amended?: string;
  /** How long it ran, in ms, when past `SLOW_LINE_MS`: said, a suite where the task's own specs would do. */
  ms?: number;
  /**
   * A failed line whose Playwright found the copy served on this port (`PORT`) and reused it: its config's `webServer`,
   * and the env it gives the server, never started. A run's dev-1 read the failure as a product bug.
   */
  reused?: number;
}

export interface PlannedTask {
  id: string;
  title: string;
  /** What it writes, by project path; a root's own modules are added by `plitzi run open --dry-run`. Disjoint across tasks. */
  files: string[];
  dependsOn: string[];
  priority: Priority;
  estimateMinutes: number;
  acceptance: Acceptance[];
  milestone?: string;
  /** Who in the team does it: developer (when left out), designer, reviewer, tester, writer… — `task next --role` picks by it. */
  role?: string;
  /**
   * Who reviews it, in order — a role each step (`["designer", "tester"]`): a step said by an agent of that role that
   * did not work it. Left out, a tester — the lead in a team with none (`reviews.ts`).
   */
  review?: string[];
  /**
   * Files outside its own it means to change — a shared one, a done task's: not held by it, but said by `run open --dry-run`, so
   * the lead sees two tasks on one file before they meet at `complete`.
   */
  touches?: string[];
  /**
   * The project's backlog items it does (`b-62`): open ones, checked at `run open --dry-run`, and closed once the run is applied —
   * said by the task that did them, never closed by hand one by one.
   */
  closes?: string[];
  /**
   * How much it asks of the model that works it (`light`, `standard`, `high`): an agent started at a level takes it
   * at that level or above. Left out, `run open --dry-run` sets one and says why — what many tasks build on is `high`.
   */
  quality?: Quality;
  /**
   * `false`: no tests of its own, with a tester in the team — the CLI gives every developer task one that writes its
   * tests (`<id>-tests`, after it) unless it says this, or the plan has a task of its tests already (`testsOf`).
   */
  tests?: false;
  /**
   * A task of tests: the tasks whose tests it writes, from what they were asked — each in its `dependsOn`. Never written
   * by an agent that worked one of them: a developer that did not (`writesTests`), else a tester. The CLI writes it on
   * the tests it adds (`<id>-tests`).
   */
  testsOf?: string[];
  /** A spike's (no files): what to find out — a lead's research, whose result is the run's next tasks (`spike.ts`). */
  spike?: string;
  /** A task to build: what the spike that made it found for it — in its brief from the start. */
  findings?: string;
}

export interface Contract {
  resource: string;
  owner: string;
  note: string;
}

/** `plan.json`: the lead's, as it wrote it. */
export interface RunPlan {
  version: 1;
  runId: string;
  goal: string;
  tasks: PlannedTask[];
  contracts?: Contract[];
  /** What every task must know from the start — a known issue, a rule of this run: the run's first notes. */
  notes?: string[];
  /**
   * The lead's primer, a Markdown file beside the plan: what the project is and how it is built, written once by the
   * lead who read it all — handed to every task with its brief, so an agent does not read the same ten files to start.
   */
  primer?: string;
  /**
   * What the job asks that this run does not do, a line each — a page, a section, a tool: said to the person at `run
   * plan` and `run open`, and in the report, so what a run leaves out is a choice made with them, never found after.
   */
  leftOut?: string[];
  /**
   * What the job asks, piece by piece: each covered by a task's checked acceptance (`covers`) or left out with its
   * reason — `run open --dry-run` refuses a piece that is neither (`inventory.ts`).
   */
  inventory?: InventoryItem[];
  /**
   * The site the run copies or follows, as its address (`https://www.example.com`): `plitzi run reference` keeps its
   * pages as they are when the run starts, and `page shot --compare` measures against what was kept — the site may
   * change while the run works, or after it (a run's original redesigned its fighter page after the copy).
   */
  reference?: string;
}

/** A task as the run holds it (`task.json`): the plan's, with its files expanded — or one the CLI made to integrate. */
export interface RunTask extends PlannedTask {
  kind: 'work' | 'integration';
  /** An integration task's: the requests it applies, as `<task>/<request>`. */
  integrates?: string[];
}

export interface Pinned {
  cli: string;
  /** Every `@plitzi/*` package installed in the project, by version. */
  packages: Record<string, string>;
}

export interface ReconciledFile {
  file: string;
  /** What each side holds: a fingerprint, or null for a file that is not there. */
  base: string | null;
  project: string | null;
  run: string | null;
  resolved?: 'project' | 'run' | 'file' | 'merged';
}

export interface Reconciliation {
  reason: string;
  at: string;
  files: ReconciledFile[];
}

export interface MergeEntry {
  id: string;
  /** The run's work written into the project, or a file put back from a backup. */
  kind: 'finish' | 'restore';
  at: string;
  /** False while it is being written: one found so after a cut is undone from its own backups. */
  complete: boolean;
  /** Each file it wrote into the project: its fingerprint before and after. */
  files: Record<string, { before: string | null; after: string | null }>;
}

/** `run.json`: the run's own record, written under its merge lock. */
export interface RunRecord {
  version: 1;
  runId: string;
  status: RunStatus;
  openedAt: string;
  activeOn: { machine: string; since: string };
  pinned: Pinned;
  /** How many tasks may be worked at once — one an agent: taking one is refused past it. */
  agents: number;
  /** What it was estimated at when it opened: what its report compares against. */
  estimate: { tasks: number; agents: number; wallMinutes: number; totalMinutes: number };
  /** Above the threshold, who confirmed the estimate: a person, by typing the run's name. */
  confirmed?: string;
  /**
   * When a person let the lead write the run into the project itself — `run open --lead-finishes`, `run finish --lead-finishes`,
   * confirmed by typing the run's name: `finish --apply` then needs no person, and still a report and green checks.
   */
  leadFinishes?: string;
  stopRequestedAt?: string;
  /** Why it is stopping: who stopped it, or what the brake saw. */
  stopReason?: string;
  forcedStopAt?: string;
  reconciliation?: Reconciliation;
  brake: BrakeEvent[];
  /** Every completion the run saw, by how it ended: its report's count, never a second log line (`completionsOf`). */
  completions?: Record<BrakeEvent['kind'], number>;
  merges: MergeEntry[];
  /** The files the lead handed it — the plan, the summary — by project path: removed with the run when unchanged. */
  inputs: { file: string; digest: string }[];
}

/**
 * What a note records, for the readers that act on it — who took a task, a block lifted, a cut, a review's comment —
 * where each read its words' start ("Taken", "Unblocked", "Cut at", "Review 2: "): a note reworded would have parted
 * them unseen. A note with none is said, never read for a fact.
 */
export const NOTE_KINDS = ['taken', 'unblocked', 'cut', 'review'] as const;

export type NoteKind = (typeof NOTE_KINDS)[number];

export interface TaskNote {
  at: string;
  by: string;
  text: string;
  kind?: NoteKind;
  /** A review comment's round. */
  round?: number;
}

export interface Waiting {
  task: string;
  since: string;
  file?: string;
  proposal?: string;
}

/** `proposals/<id>.json`: a change one task asks another to agree to — to make, or to accept in its own work. */
export interface Proposal {
  id: string;
  from: string;
  to: string;
  change: string;
  /** The file it is about, if one. */
  about?: string;
  why?: string;
  /** A counter-proposal's: the proposal it answers. */
  replyTo?: string;
  at: string;
}

/** `answers/<proposal>.json`, in the folder of the task asked: created once, so a proposal has one answer. */
export interface ProposalAnswer {
  proposal: string;
  by: string;
  /** `withdraw`: its proposer's, once the change is no longer asked — the lead changed course. */
  verdict: 'accept' | 'reject' | 'counter' | 'withdraw';
  note?: string;
  /** A counter's: the proposal made back. */
  counter?: string;
  at: string;
}

export interface KnownFailure {
  why: string;
  failing: string[];
  fixedBy?: string;
  /** The run's work fails the same way without this task: not its doing, and nothing it can fix in its files. */
  preexisting?: boolean;
  at: string;
}

/** `state.json`: a task's state and notes. */
export interface TaskState {
  status: TaskStatus;
  round: number;
  /** What it waits for from another task: a file it holds, or its answer to a proposal. */
  waitingFor?: Waiting;
  /**
   * What stops it: its agent's reason and who unblocks it (`task tell --blocked`); `review`: past the round limit, for the
   * lead to decide — approve it as it is, or answer it (`task unblock`).
   */
  blockedBy?: { reason: string; needs: Needs; review?: boolean };
  cutAt?: { step: string; reason: string; at: string };
  notes: TaskNote[];
  /** What it changed, as of its last `complete`: by project path. */
  changed?: string[];
  /**
   * Those files as they went to review, by fingerprint (null: removed): what the review keeps and the approval merges —
   * never the copy, which its agent may go on writing after `complete`.
   */
  submitted?: Record<string, string | null>;
  /** It went to review with failing checks, for a reason the lead weighs: what fails, why, and the task that fixes it. */
  knownFailure?: KnownFailure;
  /** Its acceptance's checks at its last `complete`: what passed, what did not. */
  accepted?: AcceptanceResult[];
  /** What its checks passed with but still warned of at its last `complete` — the space's lint: weighed at review. */
  warnings?: string[];
  /**
   * Its review where it stands — the step of its card's review (`reviews.ts`) it waits for, who took it: one kind of
   * review for every card, each step a role's.
   */
  review?: ReviewState;
  /** What its spikes found out, oldest first: in its brief, and in the brief of every task that waits for it. */
  findings?: Finding[];
  /**
   * A research card's result, in review with the lead: what its scout found, and the tasks it makes — the stage kept beside
   * the card (`TaskPaths.proposedStage`), stacked once the lead approves it (`task review --approve`, `--leave` what it
   * leaves out), dropped when it is sent back (`--changes`).
   */
  proposed?: { by: string; at: string; text: string; tasks: string[] };
  /**
   * The agent the lead handed it to when it took it back (`task reassign --to <agent>`): offered to that one first, and
   * taken by no other — until it takes it.
   */
  handTo?: { agent: string; by: string; at: string; reason?: string };
  updatedAt: string;
}

/** `owner.json`: who holds the task. Created exclusively — the first take wins — and removed to revoke it. */
export interface TaskOwner {
  agent: string;
  token: string;
  takenAt: string;
  machine: string;
}

export interface TaskProgress {
  fraction?: number;
  step?: string;
  heartbeatAt: string;
}

/** A `.lock`: the reservation itself, at the file's path under its task's `locks/`. */
export interface FileLock {
  runId: string;
  taskId: string;
  agent: string;
  intent: string;
  since: string;
  /** The task's own file, or a shared one held by turns. */
  kind: 'own' | 'turn';
}

export interface ReviewComment {
  file?: string;
  element?: string;
  note: string;
}

export interface TaskReview {
  round: number;
  verdict: 'approve' | 'changes';
  comments: ReviewComment[];
  by: string;
  at: string;
  /** Approved beside this task, as one change: each read a file the other makes (`task review --with`). */
  with?: string;
}

/** `requests/<id>.json`: a change a task wants in a shared file it does not hold; its version beside it. */
export interface SharedRequest {
  id: string;
  file: string;
  summary: string;
  usedIn: string[];
  blocking: boolean;
  at: string;
  /** The shared file's fingerprint the task started from, and the one of the version it asks for (null: deleted). */
  base: string | null;
  wanted: string | null;
}

/** `start.json`: what a task's copy held when it was made — the fingerprint of every file in it. */
export interface TaskStart {
  copiedAt: string;
  files: Record<string, string | null>;
  /** The files whose version came from the run's approved work, not from the project. */
  overlaid: string[];
  /**
   * The served binaries it does not own (`public/`, `vendor/`), cloned so its pages draw them, by size and time rather
   * than read whole for a fingerprint — what a change of one is told by at `complete`.
   */
  served?: Record<string, { size: number; mtimeMs: number }>;
}

export interface ApprovedFile {
  /** The approved version's fingerprint; null for a file the run deletes. */
  digest: string | null;
  /** The project's fingerprint when the run first copied it: what the final merge compares against. */
  base: string | null;
  task: string;
  at: string;
  /** The version it replaced in the run, approved before it — what reverting its task puts back. */
  previous?: ApprovedFile;
  /** Someone changed the project's file while the task worked on it, and this version is written over that change. */
  overrode?: Override;
  /** Someone changed the project's file while the task worked on it, and the two changes were put together line by line. */
  joined?: Override;
}

/**
 * What the lead decides when a file changed in the project while its task worked on it: refuse (the default — it says
 * what can be done), write the task's version over it, or put the two changes together line by line.
 */
export type ProjectChange = 'refuse' | 'overwrite' | 'merge';

/** A change made outside the run that the run's version is written over: decided by the lead, and said. */
export interface Override {
  /** The project's version written over (its blob is kept). */
  project: string | null;
  by: string;
  at: string;
}

/** `approved.json`: the run's work, approved — the run copy, as what it changes over the project. */
export interface ApprovedManifest {
  files: Record<string, ApprovedFile>;
  tasks: string[];
}

/** `base.json`: the backup taken when the run opened — every file the plan touches, as it was. */
export interface BaseManifest {
  at: string;
  files: Record<string, string | null>;
}

/** `reviewed.json`: a task's version as its last review saw it — where a cut task starts again. */
export interface ReviewedVersion {
  round: number;
  at: string;
  files: Record<string, string | null>;
}

/** `shared.json`: what the run found shared when it opened, read off the imports. */
export interface SharedManifest {
  files: { file: string; reachedBy: string[]; heldBy?: string }[];
}

/** A record's entry, or undefined when it has none: a manifest is read by file, and a file it does not name is a state. */
export const entryOf = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
  Object.hasOwn(record, key) ? record[key] : undefined;

const isDigests = (value: unknown): value is Record<string, string | null> =>
  isRecord(value) && Object.values(value).every(isDigest);

export const isPriority = oneOf(PRIORITIES);
export const isTaskStatus = oneOf(TASK_STATUSES);
const isRunStatus = oneOf(RUN_STATUSES);
const isNeeds = oneOf(NEEDS);

export const isAcceptance = (line: unknown): line is Acceptance =>
  isString(line) || (isRecord(line) && isString(line.said) && isString(line.check) && optional(line.covers, isStrings));

export const isPlannedTask = (value: unknown): value is PlannedTask =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.title) &&
  isStrings(value.files) &&
  isStrings(value.dependsOn) &&
  isPriority(value.priority) &&
  isNumber(value.estimateMinutes) &&
  Array.isArray(value.acceptance) &&
  value.acceptance.every(isAcceptance) &&
  optional(value.milestone, isString) &&
  optional(value.role, isString) &&
  optional(value.review, isStrings) &&
  optional(value.quality, oneOf(QUALITIES)) &&
  optional(value.touches, isStrings) &&
  optional(value.closes, isStrings) &&
  optional(value.tests, flag => flag === false) &&
  optional(value.testsOf, isStrings) &&
  optional(value.spike, isString) &&
  optional(value.findings, isString);

const isContract = (value: unknown): value is Contract =>
  isRecord(value) && isString(value.resource) && isString(value.owner) && isString(value.note);

export const isRunPlan = (value: unknown): value is RunPlan =>
  isRecord(value) &&
  value.version === 1 &&
  isString(value.runId) &&
  isString(value.goal) &&
  Array.isArray(value.tasks) &&
  value.tasks.every(isPlannedTask) &&
  optional(value.contracts, contracts => Array.isArray(contracts) && contracts.every(isContract)) &&
  optional(value.notes, isStrings) &&
  optional(value.primer, isString) &&
  optional(value.leftOut, isStrings) &&
  optional(value.inventory, items => Array.isArray(items) && items.every(isInventoryItem)) &&
  optional(value.reference, isSiteAddress);

export const isRunTask = (value: unknown): value is RunTask =>
  isPlannedTask(value) &&
  isRecord(value) &&
  (value.kind === 'work' || value.kind === 'integration') &&
  optional(value.integrates, isStrings);

const isReconciledFile = (value: unknown): value is ReconciledFile =>
  isRecord(value) &&
  isString(value.file) &&
  isDigest(value.base) &&
  isDigest(value.project) &&
  isDigest(value.run) &&
  optional(value.resolved, oneOf(['project', 'run', 'file', 'merged'] as const));

const isMergeEntry = (value: unknown): value is MergeEntry =>
  isRecord(value) &&
  isString(value.id) &&
  oneOf(['finish', 'restore'] as const)(value.kind) &&
  isString(value.at) &&
  typeof value.complete === 'boolean' &&
  isRecord(value.files) &&
  Object.values(value.files).every(file => isRecord(file) && isDigest(file.before) && isDigest(file.after));

export const isRunRecord = (value: unknown): value is RunRecord =>
  isRecord(value) &&
  value.version === 1 &&
  isString(value.runId) &&
  isRunStatus(value.status) &&
  isString(value.openedAt) &&
  isRecord(value.activeOn) &&
  isString(value.activeOn.machine) &&
  isString(value.activeOn.since) &&
  isRecord(value.pinned) &&
  isString(value.pinned.cli) &&
  isRecord(value.pinned.packages) &&
  Object.values(value.pinned.packages).every(isString) &&
  isNumber(value.agents) &&
  isRecord(value.estimate) &&
  isNumber(value.estimate.tasks) &&
  isNumber(value.estimate.agents) &&
  isNumber(value.estimate.wallMinutes) &&
  isNumber(value.estimate.totalMinutes) &&
  optional(value.confirmed, isString) &&
  optional(value.leadFinishes, isString) &&
  optional(value.stopRequestedAt, isString) &&
  optional(value.stopReason, isString) &&
  optional(value.forcedStopAt, isString) &&
  optional(
    value.reconciliation,
    reconciliation =>
      isRecord(reconciliation) &&
      isString(reconciliation.reason) &&
      isString(reconciliation.at) &&
      Array.isArray(reconciliation.files) &&
      reconciliation.files.every(isReconciledFile)
  ) &&
  Array.isArray(value.brake) &&
  value.brake.every(isBrakeEvent) &&
  optional(value.completions, isCompletions) &&
  Array.isArray(value.merges) &&
  value.merges.every(isMergeEntry) &&
  Array.isArray(value.inputs) &&
  value.inputs.every(input => isRecord(input) && isString(input.file) && isString(input.digest));

const isReviewState = (value: unknown): value is ReviewState =>
  isRecord(value) &&
  isNumber(value.round) &&
  isNumber(value.step) &&
  isString(value.since) &&
  optional(value.by, isString) &&
  optional(value.at, isString) &&
  optional(value.before, isStrings) &&
  optional(value.first, (flag: unknown) => flag === true);

const isNoteKind = (value: unknown): value is NoteKind => NOTE_KINDS.some(kind => kind === value);

const isNote = (value: unknown): value is TaskNote =>
  isRecord(value) &&
  isString(value.at) &&
  isString(value.by) &&
  isString(value.text) &&
  optional(value.kind, isNoteKind) &&
  optional(value.round, isNumber);

export const isTaskState = (value: unknown): value is TaskState =>
  isRecord(value) &&
  isTaskStatus(value.status) &&
  isNumber(value.round) &&
  optional(
    value.waitingFor,
    waiting =>
      isRecord(waiting) &&
      isString(waiting.task) &&
      isString(waiting.since) &&
      optional(waiting.file, isString) &&
      optional(waiting.proposal, isString)
  ) &&
  optional(
    value.blockedBy,
    blocked =>
      isRecord(blocked) &&
      isString(blocked.reason) &&
      isNeeds(blocked.needs) &&
      optional(blocked.review, (flag: unknown) => typeof flag === 'boolean') &&
      optional(blocked.spike, isString)
  ) &&
  optional(value.cutAt, cut => isRecord(cut) && isString(cut.step) && isString(cut.reason) && isString(cut.at)) &&
  Array.isArray(value.notes) &&
  value.notes.every(isNote) &&
  optional(value.findings, (findings: unknown) => Array.isArray(findings) && findings.every(isFinding)) &&
  optional(
    value.proposed,
    (proposed: unknown) =>
      isRecord(proposed) &&
      isString(proposed.by) &&
      isString(proposed.at) &&
      isString(proposed.text) &&
      isStrings(proposed.tasks)
  ) &&
  optional(
    value.handTo,
    (to: unknown) =>
      isRecord(to) && isString(to.agent) && isString(to.by) && isString(to.at) && optional(to.reason, isString)
  ) &&
  optional(value.changed, isStrings) &&
  optional(value.submitted, isDigests) &&
  optional(
    value.knownFailure,
    failure =>
      isRecord(failure) &&
      isString(failure.why) &&
      isStrings(failure.failing) &&
      optional(failure.fixedBy, isString) &&
      optional(failure.preexisting, (flag: unknown) => typeof flag === 'boolean') &&
      isString(failure.at)
  ) &&
  optional(value.warnings, isStrings) &&
  optional(value.review, isReviewState) &&
  optional(
    value.accepted,
    results =>
      Array.isArray(results) &&
      results.every(
        (result: unknown) =>
          isRecord(result) &&
          isString(result.said) &&
          isString(result.check) &&
          typeof result.ok === 'boolean' &&
          optional(result.output, isStrings) &&
          optional(result.amended, isString) &&
          optional(result.firstFailed, isStrings) &&
          optional(result.ms, isNumber) &&
          optional(result.reused, isNumber)
      )
  ) &&
  isString(value.updatedAt);

/**
 * A task blocked on a question only the lead answers (`task tell --blocked`, the lead's by default) — never a review escalated past
 * its rounds, which is a review: the lead lifts it with the answer, kept as the task's finding.
 */
export const asksLead = (state: Pick<TaskState, 'blockedBy'>): boolean =>
  state.blockedBy?.needs === 'lead' && state.blockedBy.review !== true;

export const isTaskOwner = (value: unknown): value is TaskOwner =>
  isRecord(value) &&
  isString(value.agent) &&
  isString(value.token) &&
  isString(value.takenAt) &&
  isString(value.machine);

export const isTaskProgress = (value: unknown): value is TaskProgress =>
  isRecord(value) &&
  optional(value.fraction, isNumber) &&
  optional(value.step, isString) &&
  isString(value.heartbeatAt);

export const isFileLock = (value: unknown): value is FileLock =>
  isRecord(value) &&
  isString(value.runId) &&
  isString(value.taskId) &&
  isString(value.agent) &&
  isString(value.intent) &&
  isString(value.since) &&
  (value.kind === 'own' || value.kind === 'turn');

export const isTaskReview = (value: unknown): value is TaskReview =>
  isRecord(value) &&
  isNumber(value.round) &&
  (value.verdict === 'approve' || value.verdict === 'changes') &&
  Array.isArray(value.comments) &&
  value.comments.every(
    comment =>
      isRecord(comment) &&
      isString(comment.note) &&
      optional(comment.file, isString) &&
      optional(comment.element, isString)
  ) &&
  isString(value.by) &&
  isString(value.at) &&
  optional(value.with, isString);

export const isSharedRequest = (value: unknown): value is SharedRequest =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.file) &&
  isString(value.summary) &&
  isStrings(value.usedIn) &&
  typeof value.blocking === 'boolean' &&
  isString(value.at) &&
  isDigest(value.base) &&
  isDigest(value.wanted);

export const isTaskStart = (value: unknown): value is TaskStart =>
  isRecord(value) &&
  isString(value.copiedAt) &&
  isDigests(value.files) &&
  isStrings(value.overlaid) &&
  optional(
    value.served,
    served =>
      isRecord(served) &&
      Object.values(served).every(stat => isRecord(stat) && isNumber(stat.size) && isNumber(stat.mtimeMs))
  );

const isApprovedFile = (value: unknown): value is ApprovedFile =>
  isRecord(value) &&
  isDigest(value.digest) &&
  isDigest(value.base) &&
  isString(value.task) &&
  isString(value.at) &&
  optional(value.previous, isApprovedFile) &&
  optional(
    value.overrode,
    overrode => isRecord(overrode) && isDigest(overrode.project) && isString(overrode.by) && isString(overrode.at)
  ) &&
  optional(
    value.joined,
    joined => isRecord(joined) && isDigest(joined.project) && isString(joined.by) && isString(joined.at)
  );

export const isApprovedManifest = (value: unknown): value is ApprovedManifest =>
  isRecord(value) &&
  isRecord(value.files) &&
  Object.values(value.files).every(isApprovedFile) &&
  isStrings(value.tasks);

export const isBaseManifest = (value: unknown): value is BaseManifest =>
  isRecord(value) && isString(value.at) && isDigests(value.files);

export const isMergeManifest = isMergeEntry;

export const isProposal = (value: unknown): value is Proposal =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.from) &&
  isString(value.to) &&
  isString(value.change) &&
  optional(value.about, isString) &&
  optional(value.why, isString) &&
  optional(value.replyTo, isString) &&
  isString(value.at);

export const isProposalAnswer = (value: unknown): value is ProposalAnswer =>
  isRecord(value) &&
  isString(value.proposal) &&
  isString(value.by) &&
  oneOf(['accept', 'reject', 'counter', 'withdraw'] as const)(value.verdict) &&
  optional(value.note, isString) &&
  optional(value.counter, isString) &&
  isString(value.at);

export const isReviewedVersion = (value: unknown): value is ReviewedVersion =>
  isRecord(value) && isNumber(value.round) && isString(value.at) && isDigests(value.files);

export const isSharedManifest = (value: unknown): value is SharedManifest =>
  isRecord(value) &&
  Array.isArray(value.files) &&
  value.files.every(
    file => isRecord(file) && isString(file.file) && isStrings(file.reachedBy) && optional(file.heldBy, isString)
  );
