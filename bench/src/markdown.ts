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

const range = ([low, high]: [number, number], unit = ''): string =>
  `${low.toLocaleString('en')}–${high.toLocaleString('en')}${unit}`;

/**
 * Plitzi as measured, beside what other frameworks typically cost. Throughput per vCPU is `1000 ÷ CPU ms per
 * request` — pages per second of CPU — so it compares across profiles; requests a second under a quota also carry
 * how the scheduler throttled the process.
 */
const referenceTable = (results: RunResult[]): string => {
  const measured = results.flatMap(result =>
    result.targets.flatMap(target => {
      const phase = phaseAt(target, 'page', middle(result.options.concurrency));
      if (target.status !== 'ok' || !phase || phase.cpuMsPerRequest === 0) {
        return [];
      }

      const cached = target.target.includes('cached');

      return [
        [
          `**Plitzi — ${target.target}** (${result.profile.name}, measured${cached ? ', from the cache' : ''})`,
          cell(target.idleMb, ' MB'),
          cell(target.peakMb, ' MB'),
          `${Math.round(1000 / phase.cpuMsPerRequest).toLocaleString('en')}${cached ? ' (not a render)' : ''}`
        ]
      ];
    })
  );
  const references = REFERENCES.map(reference => [
    reference.name,
    range(reference.idleMb, ' MB'),
    range(reference.loadedMb, ' MB'),
    reference.rpsPerVcpu ? range(reference.rpsPerVcpu) : '–'
  ]);

  return [
    '## Against typical published numbers',
    '',
    'The other rows are ranges from public benchmarks and deployments, not measured here: a mid-sized page (300–800',
    'nodes) rendered per request, production builds, Node 22–24. Any framework serves a cached page at 10–50k a second.',
    '',
    table(['', 'Memory at rest', 'Memory under load', 'Pages per vCPU a second'], [...measured, ...references], ['l'])
  ].join('\n');
};

/**
 * Several profiles side by side: for each target and scenario, requests a second at the middle concurrency and the
 * memory it peaked at — the one table to read first.
 */
export const markdownMatrix = (results: RunResult[]): string => {
  const profiles = results.map(result => result.profile.name);
  const keys = [
    ...new Set(
      results.flatMap(result =>
        result.targets.flatMap(target => scenariosOf(target).map(scenario => `${target.target}\u0000${scenario}`))
      )
    )
  ];
  const rows = keys.map(key => {
    const [targetName, scenario] = key.split('\u0000');

    return [
      `**${targetName}**`,
      scenario,
      ...results.map(result => {
        const target = result.targets.find(candidate => candidate.target === targetName);
        if (!target) {
          return '–';
        }

        if (target.status === 'failed') {
          return target.oomKilled ? 'OOM' : 'failed';
        }

        const phase = phaseAt(target, scenario, middle(result.options.concurrency));

        return phase ? `${cell(phase.rps)} req/s · ${cell(phase.cpuMsPerRequest)} ms · ${cell(target.peakMb)} MB` : '–';
      })
    ];
  });

  return [
    '# Bench report',
    '',
    'Each cell: requests a second at the middle concurrency · CPU per request · peak memory of the run.',
    '',
    table(['Target', 'Scenario', ...profiles], rows, ['l', 'l']),
    '',
    referenceTable(results),
    '',
    ...results.flatMap(result => [markdownRun(result), ''])
  ].join('\n');
};
