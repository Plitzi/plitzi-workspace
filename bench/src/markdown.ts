import { REFERENCES } from './references';
import { round } from './stats';

import type { Change } from './compare';
import type { PhaseResult, TargetResult } from './measure';
import type { RunResult } from './results';

const cell = (value: number | string | undefined, unit = ''): string =>
  value === undefined ? '–' : `${typeof value === 'number' ? round(value) : value}${unit}`;

const table = (header: string[], rows: string[][], align?: ('l' | 'r')[]): string => {
  const rule = header.map((_, index) => ((align?.[index] ?? 'r') === 'l' ? ':---' : '---:'));

  return [header, rule, ...rows].map(row => `| ${row.join(' | ')} |`).join('\n');
};

const failures = (phase: PhaseResult): string => {
  const statuses = Object.entries(phase.unexpected).map(([status, count]) => `${count}×${status}`);

  return [...(phase.errors > 0 ? [`${phase.errors} err`] : []), ...statuses].join(' ') || '0';
};

const scenariosOf = (target: TargetResult): string[] => [...new Set(target.phases.map(phase => phase.scenario))];

const phaseAt = (target: TargetResult, scenario: string, concurrency: number): PhaseResult | undefined =>
  target.phases.find(phase => phase.scenario === scenario && phase.concurrency === concurrency);

/** The phase a single figure is read from: the middle concurrency, where a server is loaded but not queued deep. */
const middle = (concurrency: number[]): number => concurrency[Math.floor(concurrency.length / 2)] ?? 1;

const statusOf = (target: TargetResult): string =>
  target.status === 'ok' ? 'ok' : `**failed**: ${target.failure ?? ''}${target.oomKilled ? ' (OOM)' : ''}`;

/** One row per target and scenario: throughput at every concurrency, and what it cost. */
const summaryTable = (result: RunResult): string => {
  const { concurrency } = result.options;
  const at = middle(concurrency);
  const header = [
    'Target',
    'Scenario',
    ...concurrency.map(level => `req/s c=${level}`),
    `CPU ms/req c=${at}`,
    `p99 ms c=${at}`,
    'Boot ms',
    'Idle MB',
    'Peak MB',
    'Status'
  ];
  const rows = result.targets.flatMap(target => {
    const scenarios = scenariosOf(target);
    if (scenarios.length === 0) {
      return [
        [
          target.target,
          '–',
          ...concurrency.map(() => '–'),
          '–',
          '–',
          cell(target.bootMs),
          cell(target.idleMb),
          cell(target.peakMb),
          statusOf(target)
        ]
      ];
    }

    return scenarios.map((scenario, index) => {
      const middlePhase = phaseAt(target, scenario, at);

      return [
        index === 0 ? `**${target.target}**` : '',
        scenario,
        ...concurrency.map(level => cell(phaseAt(target, scenario, level)?.rps)),
        cell(middlePhase?.cpuMsPerRequest),
        cell(middlePhase?.latencyMs.p99),
        index === 0 ? cell(target.bootMs) : '',
        index === 0 ? cell(target.idleMb) : '',
        index === 0 ? cell(target.peakMb) : '',
        index === 0 ? statusOf(target) : ''
      ];
    });
  });

  return table(header, rows, ['l', 'l']);
};

const phasesTable = (target: TargetResult): string => {
  const header = [
    'Scenario',
    'c',
    'req/s',
    'p50',
    'p90',
    'p99',
    'Failed',
    'CPU ms/req',
    'Cores',
    'Throttled',
    'Max MB',
    'Anon MB',
    'Heap MB',
    'Body'
  ];
  const rows = target.phases.map(phase => [
    phase.scenario,
    String(phase.concurrency),
    cell(phase.rps),
    cell(phase.latencyMs.p50),
    cell(phase.latencyMs.p90),
    cell(phase.latencyMs.p99),
    failures(phase),
    cell(phase.cpuMsPerRequest),
    cell(phase.cpuCores),
    phase.throttledShare === undefined ? '–' : `${Math.round(phase.throttledShare * 100)}%`,
    cell(phase.memoryMb.max),
    cell(phase.memoryMb.anonMax),
    cell(phase.processMb?.heapTotal),
    `${round(phase.bytesPerResponse / 1024)} KB`
  ]);

  return table(header, rows, ['l']);
};

const changesTable = (changes: Change[]): string =>
  changes.length === 0
    ? 'Nothing moved beyond the tolerance.'
    : table(
        ['', 'Target', 'Phase', 'Metric', 'Baseline', 'Now', 'Change'],
        changes.map(change => [
          change.verdict === 'regression' ? '🔴 worse' : '🟢 better',
          change.target,
          change.phase ?? '',
          change.metric,
          String(change.baseline),
          String(change.current),
          `${change.worseBy > 0 ? '+' : ''}${Math.round(change.worseBy * 100)}%`
        ]),
        ['l', 'l', 'l', 'l']
      );

const heading = (result: RunResult): string => {
  const { profile, options, git, host, runtime } = result;
  const limits = [
    profile.cpus === undefined ? 'no CPU limit' : `${profile.cpus} vCPU`,
    profile.memoryMb === undefined ? 'no memory limit' : `${profile.memoryMb} MB`
  ].join(' · ');
  const portals = Object.keys(result.portals);

  return [
    `## ${profile.name} — ${limits}`,
    '',
    `- **When:** ${result.date} UTC · **commit** \`${git.commit}\`${git.dirty ? ' (uncommitted changes)' : ''}`,
    `- **Where:** ${runtime.name}${runtime.details.image ? ` (${runtime.details.image}, node ${runtime.details.node})` : ''} on ${host.cpu}, ${host.cores} cores`,
    `- **Load:** ${options.concurrency.join(' / ')} connections · ${options.durationMs / 1000}s each after ${options.warmupMs / 1000}s warm-up${options.repeat > 1 ? ` · median of ${options.repeat} cold runs` : ''}`,
    `- **Node flags:** ${options.nodeOptions.length > 0 ? `\`${options.nodeOptions.join(' ')}\`` : 'none'}`,
    ...(portals.length > 0 ? [`- **Portals:** ${portals.join(', ')} — measured from working copies, not npm`] : [])
  ].join('\n');
};

/** One run, readable: what was measured and where, a summary per target, every phase, and what moved. */
export const markdownRun = (result: RunResult, changes?: Change[]): string =>
  [
    heading(result),
    '',
    summaryTable(result),
    '',
    ...result.targets.flatMap(target => [
      `### ${target.target}`,
      '',
      target.phases.length > 0 ? phasesTable(target) : statusOf(target),
      ''
    ]),
    ...(changes ? ['### Against the baseline', '', changesTable(changes), ''] : [])
  ].join('\n');

const bestRps = (target: TargetResult | undefined, scenario: string): number | undefined => {
  const rates =
    target?.status === 'ok' ? target.phases.filter(phase => phase.scenario === scenario).map(phase => phase.rps) : [];

  return rates.length > 0 ? Math.max(...rates) : undefined;
};

const thousands = (value: number): string => Math.round(value).toLocaleString('en');

const podSize = (result: RunResult): string =>
  `${result.profile.cpus ?? '∞'} vCPU / ${result.profile.memoryMb === undefined ? '∞' : `${result.profile.memoryMb} Mi`}`;

/** Plitzi at one hardware size, in the columns of the reference table. */
const plitziRow = (result: RunResult): string[] => {
  const render = result.targets.find(target => target.target === 'sdk-server-render');
  const cached = result.targets.find(target => target.target === 'sdk-server-cached');
  const rendered = bestRps(render, 'page');
  const served = bestRps(cached, 'page');
  const cpus = result.profile.cpus;
  const failed = (target: TargetResult | undefined) =>
    target?.status === 'failed' ? (target.oomKilled ? 'does not fit (OOM)' : 'does not fit') : '–';

  return [
    `**Plitzi** — ${podSize(result).replace(' / ', ' · ')}`,
    cell(render?.idleMb, ' MB'),
    cell(render?.peakMb ?? cached?.peakMb, ' MB'),
    rendered === undefined
      ? failed(render)
      : `${thousands(rendered)}${cpus === undefined ? '' : ` (${thousands(rendered / cpus)})`}`,
    served === undefined ? failed(cached) : thousands(served),
    podSize(result)
  ];
};

/**
 * The report: Plitzi at every hardware size measured, beside what other Node frameworks typically cost, in one table
 * read the same way for both. Every phase of every profile is in its own `results/<profile>-docker.md`.
 */
export const markdownReport = (results: RunResult[]): string => {
  const newest = [...results].sort((a, b) => b.date.localeCompare(a.date)).at(0);
  const header = [
    'Platform (Node server)',
    'RAM at rest',
    'RAM under load',
    'Dynamic SSR, req/s (per vCPU)',
    'Cached page, req/s',
    'Pod size (request → limit)'
  ];
  const references = REFERENCES.map(reference => [
    reference.name,
    reference.idle,
    reference.loaded,
    reference.ssrPerVcpu,
    reference.cached,
    reference.pod
  ]);

  return [
    '# Plitzi self-hosted — bench report',
    '',
    newest
      ? `Plitzi measured ${newest.date.slice(0, 10)} (\`${newest.git.commit}\`${newest.git.dirty ? ' + changes' : ''}): one page, rendered on every request and served from the cache, in a container held to each size, at 1–50 connections; the best of those. The other rows are typical ranges from public benchmarks, not measured here.`
      : 'Nothing measured yet: run `yarn bench:report`.',
    '',
    table(header, [...results.map(plitziRow), ...references], ['l', 'r', 'r', 'r', 'r', 'l']),
    '',
    'Every phase of every size — latency, CPU per request, memory — is in `results/<profile>-docker.md`.'
  ].join('\n');
};
