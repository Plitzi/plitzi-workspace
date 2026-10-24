import { brokeApproved, flakyChecks, linesAmended, linesFailing, stepsFailing } from './checks';
import { costFindings } from './cost';
import { errorFindings } from './errors';
import { explainFindings } from './explain';
import { afterStop, twoSessions, twoTasks } from './sessions';
import { FINDING_OWNERS } from './types';
import { saidFindings, workaroundFindings } from './workarounds';

import type { Finding, FindingInput, FindingOwner } from './types';
import type { RepeatedCall, RunMetrics } from '../runMetrics';
import type { TaskRoundReport } from '../taskReports';

export { factFindings } from './facts';
export { keepScratch, scratchOf } from './scratch';
export { FINDING_OWNERS } from './types';
export type { Finding, FindingInput, FindingKind, FindingOwner, PlitziArea, SaidOfPlitzi } from './types';

/** Whose first, then the most often. */
export const orderFindings = (findings: readonly Finding[]): Finding[] =>
  [...findings].sort((a, b) => FINDING_OWNERS.indexOf(a.owner) - FINDING_OWNERS.indexOf(b.owner) || b.times - a.times);

/**
 * What the run shows went wrong while it goes, read off its log and usage alone — cheap enough for every `run watch`:
 * what the lead should hear now, not at the end (a prompt three agents found wrong, a line failing try after try).
 */
export const liveFindings = (input: Pick<FindingInput, 'log' | 'usage' | 'said'>): Finding[] =>
  [
    ...twoTasks(input.log),
    ...afterStop(input.log, input.usage),
    ...twoSessions(input.usage),
    ...flakyChecks(input.log),
    ...linesFailing(input.log),
    ...errorFindings(input.usage),
    ...saidFindings(input.said)
  ].filter(finding => finding.live === true);

/** Everything the run shows went wrong that its records can say — the audit's and the report's facts added by the report. */
export const runFindings = (input: FindingInput & { repeated: readonly RepeatedCall[] }): Finding[] =>
  orderFindings([
    ...twoTasks(input.log),
    ...afterStop(input.log, input.usage),
    ...twoSessions(input.usage),
    ...flakyChecks(input.log),
    ...linesFailing(input.log),
    ...stepsFailing(input.log),
    ...brokeApproved(input.log),
    ...linesAmended(input.log),
    ...explainFindings(input.usage),
    ...workaroundFindings(input.tasks, input.scratch),
    ...saidFindings(input.said),
    ...errorFindings(input.usage),
    ...costFindings(input.usage, input.repeated, input.taskReports)
  ]);

/**
 * A run's findings as numbers, one per pattern — what the bench compares run after run, so a fix is seen to hold
 * (fewer of its kind) and a new pattern is seen to start.
 */
export interface RunIndicators {
  /** How many findings are whose. */
  findings: Record<FindingOwner, number>;
  /** Of the task checks that failed, the share that failed for nothing of the copy's own work. */
  notOwnPct?: number;
  flakyChecks: number;
  linesFailing: number;
  /** An agent with two tasks, two sessions at once, or working on after it was told to stop. */
  sessionBreaks: number;
  explainMissed: number;
  /** Scripts of the lead's own in acceptance lines, scripts and packages in the agents' scratch. */
  workarounds: number;
  /** Things said of Plitzi by two or more — a notice or what got in their way. */
  saidByMany: number;
  /** How Plitzi was to work with, the median of every round's and the lead's (`experience.ts`): 1 fought it, 5 out of the way. */
  easeMedian?: number;
  refusedAsWritten: number;
  /** What the harnesses read, in all and for each task done — when their sessions could be read. */
  harnessTokens?: number;
  harnessTokensPerTask?: number;
}

export const indicatorsOf = (
  findings: readonly Finding[],
  metrics: Pick<RunMetrics, 'checks'>,
  taskReports: readonly TaskRoundReport[],
  done: number,
  easeMedian?: number
): RunIndicators => {
  const whose = (owner: FindingOwner): number => findings.filter(finding => finding.owner === owner).length;
  const times = (...kinds: Finding['kind'][]): number =>
    findings.filter(finding => kinds.includes(finding.kind)).reduce((sum, finding) => sum + finding.times, 0);
  const failed = metrics.checks.failed + metrics.checks.notOwn;
  const read = taskReports.flatMap(report => (report.harness ? [report.harness.processed] : []));
  const harnessTokens = read.reduce((sum, value) => sum + value, 0);

  return {
    findings: { plitzi: whose('plitzi'), lead: whose('lead'), agent: whose('agent'), machine: whose('machine') },
    ...(failed > 0 ? { notOwnPct: Math.round((metrics.checks.notOwn / failed) * 100) } : {}),
    flakyChecks: times('flaky-check'),
    linesFailing: findings.filter(finding => finding.kind === 'line-failing').length,
    sessionBreaks: times('two-tasks', 'two-sessions', 'after-stop'),
    explainMissed: times('explain-missed'),
    workarounds: times('own-script', 'scratch-script', 'scratch-package'),
    saidByMany: findings.filter(finding => finding.kind === 'said' && finding.live === true).length,
    ...(easeMedian === undefined ? {} : { easeMedian }),
    refusedAsWritten: times('refused-as-written'),
    ...(read.length > 0
      ? { harnessTokens, ...(done > 0 ? { harnessTokensPerTask: Math.round(harnessTokens / done) } : {}) }
      : {})
  };
};
