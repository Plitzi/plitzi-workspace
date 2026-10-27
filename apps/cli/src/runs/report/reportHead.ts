import { teamTasks } from './bench';
import { FINDING_OWNERS } from '../findings';
import { kindOf } from '../harness';
import { tokensText } from './runMetrics';
import { costShort } from './spent';
import { briefsText } from '../plan/briefs';

import type { Finding } from '../findings';
import type { PlitziArea } from '../findings/types';
import type { HarnessUsage } from '../harness';
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

/** New, or met again and where: a repeat is what a fix did not stop. */
export const historyText = (finding: Pick<Finding, 'seenIn'>): string =>
  finding.seenIn === undefined || finding.seenIn.length === 0
    ? 'new'
    : `met before — ${finding.seenIn.join(', ')} (${ordinal(finding.seenIn.length + 1)} run)`;

const ordinal = (n: number): string => `${String(n)}${n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

/** What was met before first, the most often met first: what fixing has not stopped leads. */
const metFirst = (findings: readonly Finding[]): Finding[] =>
  [...findings].sort((a, b) => (b.seenIn?.length ?? 0) - (a.seenIn?.length ?? 0));

/** Plitzi's parts, in the order its team reads them. */
const AREA_TITLES: readonly (readonly [PlitziArea, string])[] = [
  ['cli', 'The run and the CLI'],
  ['platform', 'The platform — the SDK, the server'],
  ['docs', 'The docs and the skills']
];

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

    // Plitzi's by its part — the flow and the CLI, the platform, the docs — as its team takes them up.
    const groups =
      owner === 'plitzi'
        ? AREA_TITLES.map(([area, title]) => ({
            title,
            items: theirs.filter(finding => (finding.area ?? 'cli') === area)
          })).filter(group => group.items.length > 0)
        : [{ title: undefined, items: theirs }];
    let number = 0;

    return theirs.length === 0
      ? []
      : [
          `### ${OWNER_TITLES[owner]} (${String(theirs.length)})`,
          '',
          ...groups.flatMap(group => [
            ...(group.title === undefined ? [] : [`#### ${group.title} (${String(group.items.length)})`, '']),
            ...metFirst(group.items).flatMap(finding => {
              number += 1;

              return [
                `${String(number)}. **${finding.title}**${finding.times > 1 ? ` ×${String(finding.times)}` : ''}${finding.live ? ' · said live' : ''} · ${historyText(finding)}`,
                ...finding.evidence.map(line => `   - ${line}`),
                ...(finding.fix ? [`   - → ${finding.fix}`] : [])
              ];
            }),
            ...(group.title === undefined ? [] : [''])
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
      const key = kindOf(result.tool, result.what);
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
        ...spendText(report.spend),
        ...(report.spend ? [''] : []),
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
        ...(report.briefs ? [...briefsText(report.briefs), ''] : []),
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
  const team = teamTasks(report.tasks);
  const done = team.filter(task => task.status === 'done').length;
  const spikes = report.tasks.length - team.length;
  const { indicators, metrics } = report;

  return [
    `- Tasks: ${String(done)} of ${String(team.length)} done${spikes > 0 ? ` (and ${String(spikes)} research card${spikes === 1 ? '' : 's'})` : ''}; reviews ${String(report.tasks.reduce((sum, task) => sum + task.rounds, 0))}`,
    `- Task checks: ${String(metrics.checks.run)} run, ${String(metrics.checks.failed)} failed on the work, ${String(metrics.checks.notOwn)} on nothing of it${indicators.notOwnPct === undefined ? '' : ` (${String(indicators.notOwnPct)}% of the failures)`}`,
    `- Findings: ${FINDING_OWNERS.map(owner => `${owner} ${String(indicators.findings[owner])}`).join(', ')} — ${String(report.findings.filter(finding => (finding.seenIn?.length ?? 0) > 0).length)} met in a run before, the rest new`,
    ...(indicators.harnessTokens === undefined
      ? []
      : [
          `- The agents’ harnesses read ${tokensText(indicators.harnessTokens)} tokens${indicators.harnessTokensPerTask === undefined ? '' : `, ${tokensText(indicators.harnessTokensPerTask)} a task done`}${report.lead ? `; the lead ${tokensText(report.lead.processed)}` : ''}`
        ])
  ];
};

/**
 * What the run cost, in a few lines: at the API's prices when every model has one — with how much of every token was
 * the context read again — by agent, and the pieces that cost the most. Said alike in the report and the feedback.
 */
export const spendText = (spend: RunReport['spend']): string[] => {
  if (!spend) {
    return [];
  }

  const tokens = spend.byAgent.reduce((all, each) => all + each.tokens, 0);
  const byAgent = [...spend.byAgent]
    .sort((a, b) => (b.cost ?? b.tokens) - (a.cost ?? a.tokens))
    .map(
      each => `${each.agent} ${each.cost === undefined ? `${tokensText(each.tokens)} tokens` : costShort(each.cost)}`
    )
    .join(' · ');
  const pieces = spend.costliest.map(
    each =>
      `${each.piece === 'review' ? `${each.agent}'s review of ${each.task}` : each.piece === 'spike' ? `${each.agent} finding out ${each.task}` : `${each.agent} at ${each.task}`} ${costShort(each.cost)} (${String(each.turns)} turns)`
  );

  return [
    spend.cost === undefined
      ? `- No cost: a model it ran on has no price here — ${tokensText(tokens)} tokens, ${String(spend.cachedShare)}% of them its context read again; ${byAgent}`
      : `- At the API's prices: ${costShort(spend.cost)} — ${tokensText(tokens)} tokens, ${String(spend.cachedShare)}% of them its context read again; ${byAgent}`,
    ...(pieces.length > 0 ? [`- The costliest pieces: ${pieces.join(' · ')}`] : [])
  ];
};

/**
 * Who said the steps of the cards' reviews, by role — a run's three UI reviews were all the lead's, its designer at a
 * task of its own, and no line of the report said so.
 */
export const stepsSaidText = (tasks: readonly Pick<RunReport['tasks'][number], 'id' | 'reviewedBy'>[]): string[] => {
  const byRole = new Map<string, number>();
  for (const said of tasks.flatMap(task => task.reviewedBy ?? [])) {
    const role = said.split(':')[0] ?? said;
    byRole.set(role, (byRole.get(role) ?? 0) + 1);
  }

  return byRole.size === 0
    ? []
    : [`- Reviews said: ${[...byRole].map(([role, count]) => `${String(count)} by a ${role}`).join(', ')}`];
};
