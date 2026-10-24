import { FINDING_OWNERS } from './findings';
import { tokensText } from './runMetrics';

import type { Finding } from './findings';
import type { HarnessUsage } from './harness';
import type { RunReport } from './report';

/**
 * The head of a run's report, where a person starts: the run at a glance, its problems by whose — each with its
 * evidence and its fix — and what it spent. The facts follow in `report.ts`.
 */

const OWNER_TITLES: Record<Finding['owner'], string> = {
  plitzi: 'For Plitzi — the CLI, the platform, the docs',
  lead: 'For the lead — the plan, its lines, the team',
  agent: 'For the agents — how they worked',
  machine: 'The machine'
};

/** The findings as a person reads them: by whose they are, each numbered, with its evidence and its fix. */
export const findingsText = (
  findings: readonly Finding[],
  owners: readonly Finding['owner'][] = FINDING_OWNERS
): string[] => {
  const shown = findings.filter(finding => owners.includes(finding.owner));
  if (shown.length === 0) {
    return ['Nothing found in what the run kept.', ''];
  }

  return owners.flatMap(owner => {
    const theirs = shown.filter(finding => finding.owner === owner);

    return theirs.length === 0
      ? []
      : [
          `### ${OWNER_TITLES[owner]} (${String(theirs.length)})`,
          '',
          ...theirs.flatMap((finding, index) => [
            `${String(index + 1)}. **${finding.title}**${finding.times > 1 ? ` ×${String(finding.times)}` : ''}${finding.area ? ` · ${finding.area}` : ''}${finding.live ? ' · said live' : ''}`,
            ...finding.evidence.map(line => `   - ${line}`),
            ...(finding.fix ? [`   - → ${finding.fix}`] : [])
          ]),
          ''
        ];
  });
};

/** What the run spent, by agent and by task: the CLI's answers and, where its sessions could be read, the harness's. */
export const consumptionText = (report: RunReport): string[] => {
  const byAgent = new Map<
    string,
    { rounds: number; commands: number; chars: number; processed: number; turns: number; ran: Set<string> }
  >();
  for (const round of report.taskReports) {
    const kept = byAgent.get(round.agent) ?? {
      rounds: 0,
      commands: 0,
      chars: 0,
      processed: 0,
      turns: 0,
      ran: new Set<string>()
    };
    kept.rounds += 1;
    kept.commands += round.commands.run;
    kept.chars += round.commands.chars;
    kept.processed += round.harness?.processed ?? 0;
    kept.turns += round.harness?.turns ?? 0;
    if (round.harness) {
      kept.ran.add(ranOn(round.harness));
    }

    byAgent.set(round.agent, kept);
  }

  const heaviest = new Map<string, number>();
  const read = new Map<string, number>();
  for (const harness of [...report.taskReports.map(round => round.harness), report.lead]) {
    for (const result of harness?.heaviest ?? []) {
      const key = `${result.tool} ${result.what}`;
      heaviest.set(key, (heaviest.get(key) ?? 0) + result.reread);
    }

    for (const file of harness?.plitziRead ?? []) {
      read.set(file.file, (read.get(file.file) ?? 0) + file.times);
    }
  }

  const ranked = (counted: Map<string, number>, say: (value: number) => string): string[] =>
    [...counted]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([what, value]) => `- ${what}: ${say(value)}`);

  return report.taskReports.length === 0
    ? []
    : [
        '## What it spent',
        '',
        '| Agent | Ran on | Rounds | Commands | CLI printed (chars) | Harness turns | Harness read (tokens) |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        ...[...byAgent].map(
          ([agent, spent]) =>
            `| ${agent} | ${[...spent.ran].join(', ') || '—'} | ${String(spent.rounds)} | ${String(spent.commands)} | ${String(spent.chars)} | ${spent.turns > 0 ? String(spent.turns) : '—'} | ${spent.processed > 0 ? tokensText(spent.processed) : '—'} |`
        ),
        ...(report.lead
          ? [
              `| the lead | ${ranOn(report.lead)} | — | — | — | ${String(report.lead.turns)} | ${tokensText(report.lead.processed)} |`
            ]
          : []),
        '',
        ...(heaviest.size > 0
          ? [
              'What was read again the most — results kept in the context and read on every later turn:',
              '',
              ...ranked(heaviest, value => `${tokensText(value)} tokens`),
              ''
            ]
          : []),
        ...(read.size > 0
          ? [
              'Plitzi’s own files read the most — skills, packages’ types:',
              '',
              ...ranked(read, value => `${String(value)} times`),
              ''
            ]
          : [])
      ];
};

/** What a harness ran on, as a person compares runs by it: the harness, its model and how hard it thought. */
export const ranOn = (harness: HarnessUsage): string =>
  [harness.harness, harness.model, harness.effort].filter(Boolean).join(' · ');

/** What each review asked when it sent a task back: by task, round and whom. */
export const reviewsText = (report: RunReport): string[] => {
  const asked = report.tasks.flatMap(task => task.reviews.map(review => ({ task: task.id, ...review })));

  return asked.length === 0
    ? []
    : [
        '## What the reviews asked',
        '',
        ...asked.map(
          each => `- ${each.task}, round ${String(each.round)}, ${each.by}: ${each.asked.replace(/\s+/g, ' ')}`
        ),
        ''
      ];
};

/** The run in a few lines: what was done, what failed, how many findings whose, what it read. */
export const glanceText = (report: RunReport): string[] => {
  const done = report.tasks.filter(task => task.status === 'done').length;
  const { indicators, metrics } = report;

  return [
    `- Tasks: ${String(done)} of ${String(report.tasks.length)} done; reviews ${String(report.tasks.reduce((sum, task) => sum + task.rounds, 0))}`,
    `- Task checks: ${String(metrics.checks.run)} run, ${String(metrics.checks.failed)} failed on the work, ${String(metrics.checks.notOwn)} on nothing of it${indicators.notOwnPct === undefined ? '' : ` (${String(indicators.notOwnPct)}% of the failures)`}`,
    `- Findings: ${FINDING_OWNERS.map(owner => `${owner} ${String(indicators.findings[owner])}`).join(', ')}`,
    ...(indicators.harnessTokens === undefined
      ? []
      : [
          `- The agents’ harnesses read ${tokensText(indicators.harnessTokens)} tokens${indicators.harnessTokensPerTask === undefined ? '' : `, ${tokensText(indicators.harnessTokensPerTask)} a task done`}${report.lead ? `; the lead ${tokensText(report.lead.processed)}` : ''}`
        ])
  ];
};
