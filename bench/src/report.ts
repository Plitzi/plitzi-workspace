import { round } from './stats';

import type { Change } from './compare';
import type { TargetResult } from './measure';

const table = (header: string[], rows: string[][]): string => {
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map(row => row[column].length)));
  const line = (cells: string[]) => cells.map((cell, column) => cell.padStart(widths[column])).join('  ');

  return [line(header), line(widths.map(width => '─'.repeat(width))), ...rows.map(line)].join('\n');
};

const optional = (value: number | undefined, unit = ''): string => (value === undefined ? '–' : `${value}${unit}`);

const failures = (errors: number, unexpected: Record<number, number>): string => {
  const statuses = Object.entries(unexpected).map(([status, count]) => `${count}×${status}`);

  return [...(errors > 0 ? [`${errors} err`] : []), ...statuses].join(' ') || '0';
};

export const formatTarget = (result: TargetResult): string => {
  const summary = [
    `boot ${optional(result.bootMs, 'ms')}`,
    `idle ${optional(result.idleMb, ' MB')}${result.idleAnonMb === undefined ? '' : ` (anon ${result.idleAnonMb})`}`,
    ...(result.idleProcessMb
      ? [
          `heap ${result.idleProcessMb.heapUsed}/${result.idleProcessMb.heapTotal} MB, code ${result.idleProcessMb.codeSpace} MB`
        ]
      : []),
    `retained ${optional(result.retainedMb, ' MB')}`,
    `peak ${optional(result.peakMb, ' MB')}`,
    ...(result.oomKilled ? ['OOM-KILLED'] : [])
  ].join(' · ');
  const rows = result.phases.map(phase => [
    phase.scenario,
    String(phase.concurrency),
    String(phase.rps),
    String(round(phase.latencyMs.p50)),
    String(round(phase.latencyMs.p90)),
    String(round(phase.latencyMs.p99)),
    failures(phase.errors, phase.unexpected),
    String(phase.cpuMsPerRequest),
    String(phase.cpuCores),
    phase.throttledShare === undefined ? '–' : `${Math.round(phase.throttledShare * 100)}%`,
    String(phase.memoryMb.max),
    optional(phase.memoryMb.anonMax),
    optional(phase.processMb?.heapTotal),
    optional(phase.processMb?.codeSpace),
    `${round(phase.bytesPerResponse / 1024)}K`
  ]);
  const header = ['scenario', 'c', 'req/s', 'p50', 'p90', 'p99', 'failed', 'cpu ms/req', 'cores', 'throttled'];
  const lines = [
    `▸ ${result.target} — ${result.status === 'ok' ? 'ok' : `FAILED: ${result.failure ?? ''}`}`,
    `  ${summary}`
  ];
  if (rows.length > 0) {
    lines.push(
      table([...header, 'max MB', 'anon', 'heap', 'code', 'body'], rows)
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n')
    );
  }

  if (result.status === 'failed' && result.logsTail) {
    lines.push(
      '  last output:',
      ...result.logsTail
        .split('\n')
        .slice(-15)
        .map(line => `    ${line}`)
    );
  }

  return lines.join('\n');
};

const percent = (value: number): string => `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`;

export const formatChanges = (changes: Change[]): string => {
  if (changes.length === 0) {
    return 'No change beyond tolerance against the baseline.';
  }

  const rows = changes.map(change => [
    change.verdict === 'regression' ? 'WORSE' : 'better',
    change.target,
    change.phase ?? '',
    change.metric,
    String(change.baseline),
    String(change.current),
    percent(change.worseBy)
  ]);

  return table(['', 'target', 'phase', 'metric', 'baseline', 'now', 'worse by'], rows);
};
