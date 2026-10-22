import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { REPORTS_DIR } from './paths';

import type { RunReport } from './report';

/**
 * Each run measured the same way, kept beside its report (`<run>-<time>.json`), so runs are compared — the bench a team
 * is improved by: its minutes a task, its rounds, the share of its checks that failed, how long reviews and reworks
 * waited, what it cost. `plitzi run bench` lists them; every report ends with the runs before it.
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
  checksFailedPct: number;
  refusals: number;
  identityRefusals: number;
  uiWaitMedian?: number;
  leadWaitMedian?: number;
  reworkWaitMedian?: number;
  /** Minutes the agents waited for work, together. */
  agentsWaited: number;
  handOffs: number;
  readTokens: number;
  tokens?: number;
  tokensPerTask?: number;
  /** Calls one agent made again and again (`runMetrics.ts`'s repeated). */
  repeated: number;
}

const median = (values: readonly number[]): number | undefined => {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted.length === 0 ? undefined : sorted[Math.floor((sorted.length - 1) / 2)];
};

const tenths = (value: number): number => Math.round(value * 10) / 10;

export const benchOf = (report: RunReport, cli: string): BenchLine => {
  const { metrics } = report;
  // The work the team did: its tasks, not a scope or a spike the lead found out alone.
  const worked = report.tasks.filter(task => task.role !== 'lead (spike)');
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
    refusals: metrics.refusals.total,
    identityRefusals: Object.hasOwn(metrics.refusals.byCode, 'identity') ? metrics.refusals.byCode.identity.times : 0,
    ...(uiWait === undefined ? {} : { uiWaitMedian: uiWait }),
    ...(leadWait === undefined ? {} : { leadWaitMedian: leadWait }),
    ...(reworkWait === undefined ? {} : { reworkWaitMedian: reworkWait }),
    agentsWaited: tenths(metrics.agents.reduce((sum, agent) => sum + agent.waited, 0)),
    handOffs: metrics.handOffs,
    readTokens: metrics.cost.readTokens,
    ...(metrics.cost.tokens === undefined
      ? {}
      : {
          tokens: metrics.cost.tokens,
          ...(done > 0 ? { tokensPerTask: Math.round(metrics.cost.tokens / done) } : {})
        }),
    repeated: metrics.cost.repeated.length
  };
};

const isBenchLine = (value: unknown): value is BenchLine =>
  isRecord(value) &&
  typeof value.runId === 'string' &&
  typeof value.at === 'string' &&
  typeof value.tasks === 'number' &&
  typeof value.roundsPerTask === 'number' &&
  typeof value.checksFailedPct === 'number';

/** Every run of the project measured, oldest first: what its reports kept beside them. */
export const readBench = async (root: string): Promise<BenchLine[]> => {
  const dir = path.join(root, REPORTS_DIR);
  const files = (await fs.readdir(dir).catch((): string[] => [])).filter(file => file.endsWith('.json'));
  const lines = await Promise.all(
    files.map(async file => {
      const read: unknown = await fs
        .readFile(path.join(dir, file), 'utf-8')
        .then(text => JSON.parse(text) as unknown)
        .catch(() => undefined);

      return isRecord(read) && isBenchLine(read.bench) ? [read.bench] : [];
    })
  );

  return lines.flat().sort((a, b) => a.at.localeCompare(b.at));
};

const cell = (value: number | undefined, suffix = ''): string =>
  value === undefined ? '—' : `${String(value)}${suffix}`;
const tokens = (value: number | undefined): string =>
  value === undefined ? '—' : value >= 1000 ? `${String(Math.round(value / 100) / 10)}k` : String(value);

/** The runs as one table, each a row, oldest first — the last row the one the report is of, when one is. */
export const benchText = (lines: readonly BenchLine[]): string[] =>
  lines.length === 0
    ? ['No run of this project was measured yet: each report keeps its run’s measures beside it.']
    : [
        '| Run | Done | Worked (min) | Min / task | Rounds / task | Checks failed | Refused (identity) | UI wait | Lead wait | Rework wait | Agents waited | Handed off | Read | Tokens / task | Repeated |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        ...lines.map(
          line =>
            `| ${line.runId} | ${String(line.done)}/${String(line.tasks)} | ${cell(line.workMinutes)} | ${cell(line.minutesPerTask)} | ${String(line.roundsPerTask)} | ${String(line.checksFailedPct)}% | ${String(line.refusals)} (${String(line.identityRefusals)}) | ${cell(line.uiWaitMedian)} | ${cell(line.leadWaitMedian)} | ${cell(line.reworkWaitMedian)} | ${String(line.agentsWaited)} | ${String(line.handOffs)} | ${tokens(line.readTokens)} | ${tokens(line.tokensPerTask)} | ${String(line.repeated)} |`
        )
      ];
