import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readRunReports } from './reports';
import { tokensText } from './runMetrics';

import type { RunIndicators } from './findings';
import type { RunReport } from './report';

/**
 * The work the team did: its tasks, not a scope or a spike the lead found out alone — counted the same in the report's
 * head, its indicators and the bench (a run's head said 39 of 39, its bench 38/38).
 */
export const teamTasks = <T extends { role: string }>(tasks: readonly T[]): T[] =>
  tasks.filter(task => task.role !== 'lead (spike)');

/**
 * Each run measured the same way, kept in its report's data (`report.json`), so runs are compared — the bench a team
 * is improved by: its minutes a task, its rounds, the share of its checks that failed, how long reviews and reworks
 * waited, what it cost. `plitzi run report --bench` lists them; every report ends with the runs before it.
 */

export interface BenchLine {
  runId: string;
  at: string;
  cli: string;
  tasks: number;
  done: number;
  workMinutes?: number;
  minutesPerTask?: number;
  roundsPerTask: number;
  /** The share of `task check`s that failed for the copy's own work. */
  checksFailedPct: number;
  /** Checks that failed for nothing of the copy's — the run's work failing too, a line nothing answered. */
  checksNotOwn?: number;
  refusals: number;
  identityRefusals: number;
  uiWaitMedian?: number;
  leadWaitMedian?: number;
  reworkWaitMedian?: number;
  /** Minutes the agents waited for work, together. */
  agentsWaited: number;
  readTokens: number;
  /** What the agents' heaviest results were read again for, at the least, a task (`runMetrics.ts`'s harness). */
  rereadPerTask?: number;
  /** Calls one agent made again and again (`runMetrics.ts`'s repeated). */
  repeated: number;
  /** Minutes the agents spent inside the CLI, waits left out — and how many commands ran past their budget. */
  cliMinutes?: number;
  overBudget?: number;
  /** The run's findings as numbers, a pattern each (`findings/`): what a fix is seen to hold by, run after run. */
  indicators?: RunIndicators;
  /**
   * What a task done cost every agent's harness together — the lead's and the reviewers' too (`spent`): its tokens, and
   * its dollars at the API's prices when every model has one. Runs were compared by the CLI's answers alone.
   */
  tokensPerTask?: number;
  costPerTask?: number;
  /** How much of every token was the context read again, in whole percent. */
  cachedPct?: number;
}

const median = (values: readonly number[]): number | undefined => {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted.length === 0 ? undefined : sorted[Math.floor((sorted.length - 1) / 2)];
};

const tenths = (value: number): number => Math.round(value * 10) / 10;

export const benchOf = (report: RunReport, cli: string): BenchLine => {
  const { metrics } = report;
  const worked = teamTasks(report.tasks);
  const done = worked.filter(task => task.status === 'done').length;
  const flows = metrics.tasks.filter(flow => worked.some(task => task.id === flow.task));
  const rounds = flows.reduce((sum, flow) => sum + flow.rounds.ui + flow.rounds.lead + 1, 0);
  const uiWait = median(flows.flatMap(flow => flow.uiWaits));
  const leadWait = median(flows.flatMap(flow => flow.leadWaits));
  const reworkWait = median(flows.flatMap(flow => flow.reworkWaits));

  return {
    runId: report.runId,
    at: report.at,
    cli,
    tasks: worked.length,
    done,
    ...(metrics.workMinutes === undefined
      ? {}
      : {
          workMinutes: metrics.workMinutes,
          ...(done > 0 ? { minutesPerTask: tenths(metrics.workMinutes / done) } : {})
        }),
    roundsPerTask: flows.length === 0 ? 0 : tenths(rounds / flows.length),
    checksFailedPct: metrics.checks.run === 0 ? 0 : Math.round((metrics.checks.failed / metrics.checks.run) * 100),
    checksNotOwn: metrics.checks.notOwn,
    refusals: metrics.refusals.total,
    identityRefusals: Object.hasOwn(metrics.refusals.byCode, 'identity') ? metrics.refusals.byCode.identity.times : 0,
    ...(uiWait === undefined ? {} : { uiWaitMedian: uiWait }),
    ...(leadWait === undefined ? {} : { leadWaitMedian: leadWait }),
    ...(reworkWait === undefined ? {} : { reworkWaitMedian: reworkWait }),
    agentsWaited: tenths(metrics.agents.reduce((sum, agent) => sum + agent.waited, 0)),
    readTokens: metrics.cost.readTokens,
    ...(metrics.cost.harness === undefined || done === 0
      ? {}
      : { rereadPerTask: Math.round(metrics.cost.harness.reread / done) }),
    repeated: metrics.cost.repeated.length,
    cliMinutes: metrics.cost.cliMinutes,
    overBudget: metrics.cost.byCommand.filter(each => each.overBudget !== undefined).length,
    indicators: report.indicators,
    ...(report.spend && done > 0
      ? {
          tokensPerTask: Math.round(report.spend.byAgent.reduce((all, each) => all + each.tokens, 0) / done),
          cachedPct: report.spend.cachedShare,
          ...(report.spend.cost === undefined
            ? {}
            : { costPerTask: Math.round((report.spend.cost / done) * 100) / 100 })
        }
      : {})
  };
};

const isBenchLine = (value: unknown): value is BenchLine =>
  isRecord(value) &&
  typeof value.runId === 'string' &&
  typeof value.at === 'string' &&
  typeof value.tasks === 'number' &&
  typeof value.roundsPerTask === 'number' &&
  typeof value.checksFailedPct === 'number';

/** Every run of the project measured, oldest first: what its reports kept (`reports.ts`). */
export const readBench = async (root: string): Promise<BenchLine[]> =>
  (await readRunReports(root)).flatMap(({ data }) => (isBenchLine(data.bench) ? [data.bench] : []));

// A measure kept as `null` — a NaN written to JSON, as a run's agents' wait was — is no number to print.
const cell = (value: number | null | undefined, suffix = ''): string =>
  typeof value !== 'number' || !Number.isFinite(value) ? '—' : `${String(value)}${suffix}`;
const tokens = (value: number | undefined): string => (value === undefined ? '—' : tokensText(value));

/** The runs as one table, each a row, oldest first — the last row the one the report is of, when one is. */
export const benchText = (lines: readonly BenchLine[]): string[] =>
  lines.length === 0
    ? ['No run of this project was measured yet: each report keeps its run’s measures beside it.']
    : [
        '| Run | Done | Worked (min) | Min / task | Rounds / task | Checks failed | Not theirs | Refused (identity) | UI wait | Lead wait | Rework wait | Agents waited | Read | Read again / task (≥) | Repeated | In the CLI (min) | Over budget |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        ...lines.map(
          line =>
            `| ${line.runId} | ${String(line.done)}/${String(line.tasks)} | ${cell(line.workMinutes)} | ${cell(line.minutesPerTask)} | ${String(line.roundsPerTask)} | ${String(line.checksFailedPct)}% | ${cell(line.checksNotOwn)} | ${String(line.refusals)} (${String(line.identityRefusals)}) | ${cell(line.uiWaitMedian)} | ${cell(line.leadWaitMedian)} | ${cell(line.reworkWaitMedian)} | ${cell(line.agentsWaited)} | ${tokens(line.readTokens)} | ${tokens(line.rereadPerTask)} | ${String(line.repeated)} | ${cell(line.cliMinutes)} | ${cell(line.overBudget)} |`
        ),
        '',
        // The patterns the findings count, a run a row: a fix holds when its column falls (runs before them say —).
        '| Run | Ease (1–5) | Findings (Plitzi · lead · agents · machine) | Met before | Failures not theirs | Flaky checks | Lines failing | Session breaks | explain missed | Done beside the CLI | Said by 2+ | Refused as written | Harness read / task |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        ...lines.map(line => {
          const of = line.indicators;

          return of === undefined
            ? `| ${line.runId} | — | — | — | — | — | — | — | — | — | — | — | — |`
            : `| ${line.runId} | ${cell(of.easeMedian)} | ${String(of.findings.plitzi)} · ${String(of.findings.lead)} · ${String(of.findings.agent)} · ${String(of.findings.machine)} | ${cell(of.metBefore)} | ${cell(of.notOwnPct, '%')} | ${String(of.flakyChecks)} | ${String(of.linesFailing)} | ${String(of.sessionBreaks)} | ${String(of.explainMissed)} | ${String(of.workarounds)} | ${String(of.saidByMany)} | ${String(of.refusedAsWritten)} | ${tokens(of.harnessTokensPerTask)} |`;
        }),
        '',
        // What a task cost every harness together, the lead's included — runs before it kept none (—).
        '| Run | Tokens / task (all agents) | Cost / task (API prices) | Read again |',
        '| --- | --- | --- | --- |',
        ...lines.map(
          line =>
            `| ${line.runId} | ${tokens(line.tokensPerTask)} | ${line.costPerTask === undefined ? '—' : `$${line.costPerTask.toFixed(2)}`} | ${cell(line.cachedPct, '%')} |`
        )
      ];
