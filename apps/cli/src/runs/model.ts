import { isRecord } from '@plitzi/sdk-shared/helpers';

import { isDesignSkip } from './designSkip';
import { isDigest, isNumber, isSiteAddress, isString, isStrings, oneOf, optional } from './guards';
import { isInventoryItem } from './inventory';

import type { DesignSkip } from './designSkip';
import type { InventoryItem } from './inventory';

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
 * How much a task asks of the model that works it: `light` — a mechanical change; `standard` — most work; `high` — what
 * many tasks build on, or what is designed new. An agent started at a level takes tasks of it or below, never above.
 */
export const QUALITIES = ['light', 'standard', 'high'] as const;
export type Quality = (typeof QUALITIES)[number];
export type Needs = (typeof NEEDS)[number];

/**
 * A line of a task's acceptance: what is asked — and, when a command can tell, the command that checks it: run in the
 * task's copy at `complete`, it passes on exit 0. `$PLITZI_URL` in it is the copy served, `plitzi` this CLI:
 * `plitzi page check /walks --url $PLITZI_URL --expect walks-title~October`.
 */
/** A line of acceptance: a sentence the review weighs, or one a command proves — and the inventory's pieces it proves. */
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
}

export interface PlannedTask {
  id: string;
  title: string;
  /** What it writes, by project path; a root's own modules are added by `plitzi run plan`. Disjoint across tasks. */
  files: string[];
  dependsOn: string[];
  priority: Priority;
  estimateMinutes: number;
  acceptance: Acceptance[];
  milestone?: string;
  /** Who in the team does it: developer (when left out), designer, reviewer, tester, writer… — `task next --role` picks by it. */
  role?: string;
  /**
   * Files outside its own it means to change — a shared one, a done task's: not held by it, but said by `run plan`, so
   * the lead sees two tasks on one file before they meet at `complete`.
   */
  touches?: string[];
  /**
   * How much it asks of the model that works it (`light`, `standard`, `high`): an agent started at a level takes it
   * at that level or above. Left out, `run plan` sets one and says why — what many tasks build on is `high`.
   */
  quality?: Quality;
  /**
   * `false`: no tests of its own, with a tester in the team — the CLI gives every developer task one that writes its
   * tests (`<id>-tests`, after it) unless it says this, or the plan has a tester's task that waits for it already.
   */
  tests?: false;
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
   * Whether a designer reviews the UI of the others' tasks before the lead: on with a designer in the team, off with
   * none — said here to turn it the other way for this run. A stage's (`run extend`) keeps the run's choice: it may only
   * turn it on.
   */
  designReview?: boolean;
  /**
   * What the job asks that this run does not do, a line each — a page, a section, a tool: said to the person at `run
   * plan` and `run open`, and in the report, so what a run leaves out is a choice made with them, never found after.
   */
  leftOut?: string[];
  /**
   * What the job asks, piece by piece: each covered by a task's checked acceptance (`covers`) or left out with its
   * reason — `run plan` refuses a piece that is neither (`inventory.ts`).
   */
  inventory?: InventoryItem[];
  /**
   * The site the run copies or follows, as its address (`https://www.example.com`): `plitzi run reference` keeps its
   * pages as they are when the run starts, and `page shot --compare` measures against what was kept — the site may
   * change while the run works, or after it (la-velada's original redesigned its fighter page after the copy).
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

export interface BrakeEvent {
  kind: 'completed' | 'refused' | 'checks-failed' | 'conflict';
  at: string;
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
  /** How many tasks may be worked at once — one an agent: `task take` refuses past it. */
  agents: number;
  /**
   * The leads besides `lead` (`lead-2`…), as the team had them when it opened or was extended: they review, from one
   * queue (`TaskState.reviewer`); planning, answering and finishing stay `lead`'s.
   */
  leads?: string[];
  /** What it was estimated at when it opened: what its report compares against. */
  estimate: { tasks: number; agents: number; wallMinutes: number; totalMinutes: number };
  /** Above the threshold, who confirmed the estimate: a person, by typing the run's name. */
  confirmed?: string;
  /**
   * When a person let the lead write the run into the project itself — `run open --lead-finishes`, `run allow-finish`,
   * confirmed by typing the run's name: `finish --apply` then needs no person, and still a report and green checks.
   */
  leadFinishes?: string;
  /**
   * A designer in the team, or the plan asked for it: the UI of the others' tasks — what they change under `src/space/` or a
   * plugin — is reviewed by a designer before the lead approves it (`TaskState.design`).
   */
  designReview?: true;
  stopRequestedAt?: string;
  /** Why it is stopping: who stopped it, or what the brake saw. */
  stopReason?: string;
  forcedStopAt?: string;
  reconciliation?: Reconciliation;
  brake: BrakeEvent[];
  merges: MergeEntry[];
  /** The files the lead handed it — the plan, the summary — by project path: removed with the run when unchanged. */
  inputs: { file: string; digest: string }[];
}

export interface TaskNote {
  at: string;
  by: string;
  text: string;
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
  verdict: 'accept' | 'reject' | 'counter';
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
  /**
   * Of its rounds of changes, the designer's: the limit before a person looks at it is counted apart for the designer's
   * UI review and the lead's, so a task with a designer is not at a person after one round of the lead's.
   */
  designRounds?: number;
  /** What it waits for from another task: a file it holds, or its answer to a proposal. */
  waitingFor?: Waiting;
  /** `review`: sent to a person after the round limit — who may approve it as it is, or answer it (`task unblock`). */
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
   * Its UI's review by a designer, in a run that has one: `due` from its `complete` until a designer says — the agent
   * who took it to review, once one did (`task next --take`) — and `approved` once it did: then it is the lead's.
   */
  design?: DesignReview;
  /** The lead that took this round's review from the queue (`task next --role lead`): another lead is not offered it. */
  reviewer?: { by: string; round: number; at: string };
  updatedAt: string;
}

export interface DesignReview {
  status: 'due' | 'approved' | 'skipped';
  /** The round of the work it reviews. */
  round: number;
  /** The designer who took it, or said it. */
  by?: string;
  at?: string;
  /** `skipped`: why the lead approved it without the designer's review. */
  why?: DesignSkip;
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

const isAcceptance = (line: unknown): line is Acceptance =>
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
  optional(value.quality, oneOf(QUALITIES)) &&
  optional(value.touches, isStrings) &&
  optional(value.tests, flag => flag === false);

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
  optional(value.designReview, flag => typeof flag === 'boolean') &&
  optional(value.leftOut, isStrings) &&
  optional(value.inventory, items => Array.isArray(items) && items.every(isInventoryItem)) &&
  optional(value.reference, isSiteAddress);

const shown = (value: unknown): string => (value === undefined ? 'nothing' : JSON.stringify(value));

/** What keeps `value` from being a plan, field by field — each said with what it should hold. Empty for a plan. */
export const runPlanProblems = (value: unknown): string[] => {
  if (!isRecord(value)) {
    return ['the file holds no object'];
  }

  const problems: string[] = [];
  const field = (ok: boolean, name: string, should: string): void => {
    if (!ok) {
      problems.push(`${name}: ${should}, not ${shown(value[name])}`);
    }
  };
  field(value.version === 1, 'version', '1');
  field(isString(value.runId), 'runId', 'the run’s name');
  field(isString(value.goal), 'goal', 'a line of what the run is for');
  field(optional(value.leftOut, isStrings), 'leftOut', 'lines of what the run does not do');
  field(
    optional(value.reference, isSiteAddress),
    'reference',
    'the address of the site it copies — https://www.example.com'
  );
  field(
    optional(value.inventory, items => Array.isArray(items) && items.every(isInventoryItem)),
    'inventory',
    'pieces, each { id, piece, page?, leftOut? }'
  );
  if (!Array.isArray(value.tasks)) {
    problems.push('tasks: a list of tasks');

    return problems;
  }

  value.tasks.forEach((each: unknown, index) => {
    const at = `tasks[${String(index)}]${isRecord(each) && isString(each.id) ? ` ("${each.id}")` : ''}`;
    if (!isRecord(each)) {
      problems.push(`${at}: an object`);

      return;
    }

    const check = (ok: boolean, name: string, should: string): void => {
      if (!ok) {
        problems.push(`${at}.${name}: ${should}, not ${shown(each[name])}`);
      }
    };
    check(isString(each.id), 'id', 'its name');
    check(isString(each.title), 'title', 'a line');
    check(isStrings(each.files), 'files', 'the paths it writes');
    check(isStrings(each.dependsOn), 'dependsOn', 'the ids it waits for ([] for none)');
    check(isPriority(each.priority), 'priority', PRIORITIES.join(', '));
    check(isNumber(each.estimateMinutes), 'estimateMinutes', 'minutes, a number');
    check(
      Array.isArray(each.acceptance) && each.acceptance.every(isAcceptance),
      'acceptance',
      'lines, each a sentence or { said, check, covers? } — a line that covers a piece of the inventory is one a command checks'
    );
    check(optional(each.role, isString), 'role', 'a role’s name');
    check(optional(each.quality, oneOf(QUALITIES)), 'quality', 'light, standard or high');
    check(optional(each.milestone, isString), 'milestone', 'a name');
    check(optional(each.touches, isStrings), 'touches', 'paths');
    check(
      optional(each.tests, flag => flag === false),
      'tests',
      'false, or left out'
    );
  });

  return problems;
};

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
  optional(value.leads, isStrings) &&
  isRecord(value.estimate) &&
  isNumber(value.estimate.tasks) &&
  isNumber(value.estimate.agents) &&
  isNumber(value.estimate.wallMinutes) &&
  isNumber(value.estimate.totalMinutes) &&
  optional(value.confirmed, isString) &&
  optional(value.leadFinishes, isString) &&
  optional(value.designReview, flag => flag === true) &&
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
  value.brake.every(
    event =>
      isRecord(event) &&
      oneOf(['completed', 'refused', 'checks-failed', 'conflict'] as const)(event.kind) &&
      isString(event.at)
  ) &&
  Array.isArray(value.merges) &&
  value.merges.every(isMergeEntry) &&
  Array.isArray(value.inputs) &&
  value.inputs.every(input => isRecord(input) && isString(input.file) && isString(input.digest));

const isNote = (value: unknown): value is TaskNote =>
  isRecord(value) && isString(value.at) && isString(value.by) && isString(value.text);

export const isTaskState = (value: unknown): value is TaskState =>
  isRecord(value) &&
  isTaskStatus(value.status) &&
  isNumber(value.round) &&
  optional(value.designRounds, isNumber) &&
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
      optional(blocked.review, (flag: unknown) => typeof flag === 'boolean')
  ) &&
  optional(value.cutAt, cut => isRecord(cut) && isString(cut.step) && isString(cut.reason) && isString(cut.at)) &&
  Array.isArray(value.notes) &&
  value.notes.every(isNote) &&
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
  optional(
    value.design,
    design =>
      isRecord(design) &&
      oneOf(['due', 'approved', 'skipped'] as const)(design.status) &&
      isNumber(design.round) &&
      optional(design.by, isString) &&
      optional(design.at, isString) &&
      optional(design.why, isDesignSkip)
  ) &&
  optional(
    value.reviewer,
    reviewer => isRecord(reviewer) && isString(reviewer.by) && isNumber(reviewer.round) && isString(reviewer.at)
  ) &&
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
          optional(result.firstFailed, isStrings)
      )
  ) &&
  isString(value.updatedAt);

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
  isString(value.at);

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
  oneOf(['accept', 'reject', 'counter'] as const)(value.verdict) &&
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
