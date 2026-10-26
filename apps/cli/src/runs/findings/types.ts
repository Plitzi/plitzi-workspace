import type { RunTask } from '../model';
import type { TaskRoundReport } from '../taskReports';
import type { UsageLine } from '../usage';

/**
 * What a run shows went wrong, one list for everyone who reads it — the lead while it goes (`run watch`), the person
 * at its end (`run report`), Plitzi's team (`run report --plitzi`) and the next run's bench — read off what the run kept, so
 * nobody has to write it down by hand: a run's lead kept 65 problems in a journal, each found by reading the log.
 */

/** Who acts on it. */
export type FindingOwner = 'plitzi' | 'lead' | 'agent' | 'machine';

export const FINDING_OWNERS: readonly FindingOwner[] = ['plitzi', 'lead', 'agent', 'machine'];

/** Which part of Plitzi, for one of Plitzi's. */
export type PlitziArea = 'cli' | 'platform' | 'docs';

export type FindingKind =
  // How the run's sessions and tasks were held.
  | 'two-tasks'
  | 'after-stop'
  | 'two-sessions'
  // Checks.
  | 'flaky-check'
  | 'line-failing'
  | 'step-failing'
  | 'broke-approved'
  | 'lines-amended'
  // What the agents looked for, and did beside the CLI.
  | 'explain-missed'
  | 'explain-topic'
  | 'own-script'
  | 'scratch-script'
  | 'scratch-package'
  | 'scratch-copy'
  | 'said'
  // Commands that failed, by why.
  | 'refused-as-written'
  | 'machine-error'
  | 'command-errors'
  | 'refused-loop'
  | 'crashed'
  // What it cost.
  | 'repeated-call'
  | 'large-output'
  | 'costly-task'
  | 'context-heavy'
  | 'costly-result'
  // How the run was worked (`audit.ts`) and what it came to (`report.ts`).
  | 'approval-missing'
  | 'slow-review'
  | 'known-failure'
  | 'sent-back'
  | 'ui-skipped'
  | 'ui-review-wasted'
  | 'preview-sync'
  | 'brake'
  | 'unfinished'
  | 'blocked'
  | 'cut'
  | 'over-estimate'
  | 'slow-close'
  | 'conflict'
  | 'overwrite'
  | 'joined'
  | 'stopped'
  | 'unanswered-proposal';

export interface Finding {
  /** What kind of thing went wrong: the same across runs, what patterns are counted by. */
  kind: FindingKind;
  owner: FindingOwner;
  area?: PlitziArea;
  /** What went wrong, in a line. */
  title: string;
  /** The facts it was read from — tasks, agents, times, commands, counts — a line each. */
  evidence: string[];
  /** How many times it happened. */
  times: number;
  /** What would stop it happening again. */
  fix?: string;
  /** What keeps it the same finding while its words change — an agent, a task, a line: a live one wakes the lead once. */
  subject: string;
  /** The task it is about, when one: a live one leaves the lead's attention once that task is past it. */
  task?: string;
  /** Said to the lead while the run goes (`run watch`), not only at its end. */
  live?: true;
}

/** Something said of Plitzi by whoever worked: a notice as it happened, or a friction said with a round or the report. */
export interface SaidOfPlitzi {
  at: string;
  by: string;
  text: string;
  task?: string;
  on?: string;
  as: 'notice' | 'friction';
}

/** An entry of the run's log, as it was written. */
export type LogEntry = Record<string, unknown>;

/** What the findings are read from: all of it kept by the run as it went. */
export interface FindingInput {
  log: readonly LogEntry[];
  usage: readonly UsageLine[];
  tasks: readonly RunTask[];
  /** What was said of Plitzi: the notices as they came, and what got in the way of each round and of the lead. */
  said: readonly SaidOfPlitzi[];
  /** What each agent wrote in its scratch beside the CLI: its scripts and the packages it installed. */
  scratch: readonly { agent: string; scripts: string[]; packages: string[]; copies?: string[] }[];
  /** Each round of each task as its agent completed it (`taskReports.ts`). */
  taskReports: readonly TaskRoundReport[];
}

export const text = (value: unknown): string => (typeof value === 'string' ? value : '');

export const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : [];

/** A time of the log, as a person reads it next to the others: `HH:MM UTC`. */
export const clock = (at: unknown): string => `${text(at).slice(11, 16)} UTC`;

/** At most this many lines of evidence a finding says; the rest counted. */
export const EVIDENCE_LINES = 8;

export const evidenceOf = (lines: readonly string[]): string[] =>
  lines.length <= EVIDENCE_LINES
    ? [...lines]
    : [...lines.slice(0, EVIDENCE_LINES), `… and ${String(lines.length - EVIDENCE_LINES)} more`];
