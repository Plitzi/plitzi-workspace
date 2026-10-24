import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { experienceText } from './experience';
import { buildReport, readSummary } from './report';
import { findingsText, ranOn } from './reportHead';
import { commandName, tokensText } from './runMetrics';
import { projectFormatter } from '../commands/projectFormatter';
import { formattedJson } from '../scaffold/formattedJson';

import type { AgentTimeline } from './agentTimeline';
import type { CombinedExperience } from './experience';
import type { Finding, RunIndicators } from './findings';
import type { HarnessUsage } from './harness';
import type { LoadedRun, RunContext } from './run';

/**
 * A run's feedback to Plitzi — what a multi-agent run says of Plitzi itself, as `plitzi feedback` is a single agent's:
 * each agent's reports of its rounds (`taskReports.ts`, with what got in its way in its words), the lead's report on
 * top, and what the run's records show was Plitzi's (`findings/`) — consolidated as the run ends, for the person to
 * share with Plitzi's team: so a run on any project says what Plitzi should fix or improve.
 *
 * Written twice beside the project's team and backlog, never sent by itself: as Markdown to read, and as JSON to analyse
 * across runs and projects (`RunFeedback`). Nothing of the project's code in it, no token, no path of the person's
 * machine — how Plitzi behaved, and what it cost.
 */

export const FEEDBACK_DIR = path.join('.plitzi', 'feedback');

/** What the feedback's data is shaped as: what reads it across runs knows which it reads. */
export const FEEDBACK_VERSION = 1;

/** A run's feedback to Plitzi as data: the JSON beside its Markdown. */
export interface RunFeedback {
  version: typeof FEEDBACK_VERSION;
  kind: 'run';
  runId: string;
  /** The Plitzi it ran on: the CLI and every package the run pinned. */
  pinned: LoadedRun['record']['pinned'];
  openedAt: string;
  at: string;
  minutes: number;
  tasks: { total: number; done: number; rounds: number };
  agents: string[];
  /** What the run's records show was Plitzi's — or the machine's. */
  findings: Finding[];
  indicators: RunIndicators;
  /**
   * What it was like to work with Plitzi, in their words: every round's and the lead's, combined — the ease, what cost
   * the most, what got in the way and what helped, each said by several grouped with who said it.
   */
  experience: CombinedExperience;
  /** The lead's report of the run (`run report --summary`), and what its own sessions spent. */
  lead: { report?: string; harness?: HarnessUsage };
  checks: { run: number; failed: number; notOwn: number; byStep: Record<string, number> };
  refusals: { code: string; times: number; command?: string }[];
  /** What each agent spent: the CLI's answers it read, and its harness's tokens when its sessions could be read. */
  spent: {
    agent: string;
    /** The harness, model and effort it ran on, each one it ran on. */
    ranOn: string[];
    rounds: number;
    commands: number;
    cliChars: number;
    harnessTurns: number;
    harnessTokens: number;
  }[];
  /** The kinds of result read again the most over the run, in tokens. */
  rereadMost: { what: string; reread: number }[];
  /** Plitzi's own files — skills, packages' types — read the most: the docs a fix starts from. */
  plitziReadMost: { file: string; times: number }[];
  /** What each review asked when it sent a task back: the agent's mistake, or what Plitzi did not let it see. */
  reviewsAsked: { task: string; round: number; by: string; asked: string }[];
  /**
   * Each agent's life, in figures: how often it was started and stopped, its minutes at work, stopped and silent, and
   * why it stopped — what a board reading "no signal" or a team stopped for good is read from (the report has its moments).
   */
  lives: {
    agent: string;
    launches: number;
    minutes: AgentTimeline['minutes'];
    stoppedFor: { why: string; times: number }[];
  }[];
}

/** The feedback's Markdown for a run, in the project; its JSON beside it. */
export const feedbackFile = (root: string, runId: string): string => path.join(root, FEEDBACK_DIR, `${runId}.md`);

/** A text with the person's machine left out: the project's folder and their home said as such, a token's secret cut. */
const sanitized = (root: string, text: string): string =>
  text
    .replaceAll(root, '<project>')
    .replaceAll(os.homedir(), '~')
    .replace(/\b[\w-]+\.(?:@[\w-]+|t-[\w-]+)\.[0-9a-f]{16,}\b/g, '<token>');

const section = (title: string, lines: readonly string[]): string[] =>
  lines.length === 0 ? [] : [`## ${title}`, '', ...lines, ''];

/** Every text in it with the person's machine left out — the agents' words and the lead's report too. */
const sanitizedData = (root: string, data: RunFeedback): RunFeedback => {
  const clean = (value: unknown): unknown =>
    typeof value === 'string'
      ? sanitized(root, value)
      : Array.isArray(value)
        ? value.map(clean)
        : typeof value === 'object' && value !== null
          ? Object.fromEntries(Object.entries(value).map(([key, each]) => [key, clean(each)]))
          : value;

  // The same shape back, its strings cleaned: what `clean` maps keeps every key and every type but the strings' text.
  return clean(data) as RunFeedback;
};

const countBy = (values: readonly string[]): Map<string, number> => {
  const counted = new Map<string, number>();
  for (const value of values) {
    counted.set(value, (counted.get(value) ?? 0) + 1);
  }

  return counted;
};

export const feedbackOf = async (ctx: RunContext, loaded: LoadedRun): Promise<RunFeedback> => {
  const report = await buildReport(ctx, loaded);
  const { metrics } = report;
  const spent = new Map<string, RunFeedback['spent'][number]>();
  const reread = new Map<string, number>();
  const read = new Map<string, number>();
  for (const round of report.taskReports) {
    const kept = spent.get(round.agent) ?? {
      agent: round.agent,
      ranOn: [],
      rounds: 0,
      commands: 0,
      cliChars: 0,
      harnessTurns: 0,
      harnessTokens: 0
    };
    kept.rounds += 1;
    kept.commands += round.commands.run;
    kept.cliChars += round.commands.chars;
    kept.harnessTurns += round.harness?.turns ?? 0;
    kept.harnessTokens += round.harness?.processed ?? 0;
    if (round.harness && !kept.ranOn.includes(ranOn(round.harness))) {
      kept.ranOn.push(ranOn(round.harness));
    }

    spent.set(round.agent, kept);
    for (const file of round.harness?.plitziRead ?? []) {
      read.set(file.file, (read.get(file.file) ?? 0) + file.times);
    }

    for (const result of round.harness?.heaviest ?? []) {
      const what = `${result.tool} ${result.what}`;
      reread.set(what, (reread.get(what) ?? 0) + result.reread);
    }
  }

  const summary = (await readSummary(loaded))?.trim();

  return sanitizedData(ctx.root, {
    version: FEEDBACK_VERSION,
    kind: 'run',
    runId: loaded.record.runId,
    pinned: loaded.record.pinned,
    openedAt: report.openedAt,
    at: report.at,
    minutes: report.minutes,
    tasks: {
      total: report.tasks.length,
      done: report.tasks.filter(task => task.status === 'done').length,
      rounds: report.tasks.reduce((sum, task) => sum + task.rounds, 0)
    },
    agents: metrics.agents.map(agent => agent.agent),
    findings: report.findings.filter(finding => finding.owner === 'plitzi' || finding.owner === 'machine'),
    indicators: report.indicators,
    experience: report.experience,
    lead: { ...(summary ? { report: summary } : {}), ...(report.lead ? { harness: report.lead } : {}) },
    checks: {
      run: metrics.checks.run,
      failed: metrics.checks.failed,
      notOwn: metrics.checks.notOwn,
      byStep: metrics.checks.byStep
    },
    refusals: Object.entries(metrics.refusals.byCode)
      .map(([code, refused]) => ({
        code,
        times: refused.times,
        ...(refused.command ? { command: commandName(refused.command) } : {})
      }))
      .sort((a, b) => b.times - a.times),
    spent: [...spent.values()],
    rereadMost: [...reread]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([what, tokens]) => ({ what, reread: tokens })),
    plitziReadMost: [...read]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([file, times]) => ({ file, times })),
    reviewsAsked: report.tasks.flatMap(task => task.reviews.map(review => ({ task: task.id, ...review }))),
    lives: report.agents.map(life => ({
      agent: life.agent,
      launches: life.launches,
      minutes: life.minutes,
      stoppedFor: [...countBy(life.stops.map(stop => stop.what.replace(/^stopped: /, '').split(':')[0]))].map(
        ([why, times]) => ({ why, times })
      )
    }))
  });
};

/** The feedback as a person reads it, from its data. */
export const feedbackText = (data: RunFeedback): string =>
  [
    `# Plitzi feedback — run ${data.runId}`,
    '',
    `CLI ${data.pinned.cli} · ${data.openedAt.slice(0, 10)} · ${String(data.tasks.done)} of ${String(data.tasks.total)} tasks, ${String(data.agents.length)} agents · ${String(data.minutes)} min`,
    '',
    'What this run says of Plitzi itself — its agents’ reports of each task, the lead’s, and what the run’s records show —',
    'consolidated by the CLI as the run ended, nothing of the project’s code in it. Share it with Plitzi’s team (this file',
    'and the JSON beside it): it is how a run on any project makes Plitzi better.',
    '',
    '## What the run shows was Plitzi’s',
    '',
    ...findingsText(data.findings, ['plitzi', 'machine']),
    '## Using Plitzi — what it was like, every round’s and the lead’s',
    '',
    ...experienceText(data.experience),
    ...section('The lead’s report', data.lead.report ? [data.lead.report] : []),
    // A list, not a table: what Prettier leaves as it is, so the file never fails the project's format check.
    ...section('What it spent', [
      ...data.spent.map(
        each =>
          `- ${each.agent}${each.ranOn.length > 0 ? ` (${each.ranOn.join('; ')})` : ''}: ${String(each.rounds)} round(s), ${String(each.commands)} commands, the CLI printed ${String(each.cliChars)} characters${each.harnessTokens > 0 ? `; its harness read ${tokensText(each.harnessTokens)} tokens in ${String(each.harnessTurns)} turns` : ''}`
      ),
      ...(data.lead.harness
        ? [
            `- the lead: its harness read ${tokensText(data.lead.harness.processed)} tokens in ${String(data.lead.harness.turns)} turns`
          ]
        : []),
      ...(data.rereadMost.length > 0
        ? [
            '',
            'Read again the most:',
            '',
            ...data.rereadMost.map(each => `- ${each.what}: ${tokensText(each.reread)} tokens`)
          ]
        : []),
      ...(data.plitziReadMost.length > 0
        ? [
            '',
            'Plitzi’s own files read the most:',
            '',
            ...data.plitziReadMost.map(each => `- ${each.file}: ${String(each.times)} times`)
          ]
        : [])
    ]),
    ...section(
      'What the reviews asked',
      data.reviewsAsked.map(
        each => `- ${each.task}, round ${String(each.round)}, ${each.by}: ${each.asked.replace(/\s+/g, ' ')}`
      )
    ),
    ...section(
      'Refusals, by code',
      data.refusals.map(each => `- ${each.code} ×${String(each.times)}${each.command ? ` — e.g. ${each.command}` : ''}`)
    ),
    ...section('Checks', [
      `- ${String(data.checks.run)} task checks: ${String(data.checks.failed)} failed for the work, ${String(data.checks.notOwn)} for nothing of it`,
      ...Object.entries(data.checks.byStep)
        .sort(([, a], [, b]) => b - a)
        .map(([step, times]) => `  - ${step} ×${String(times)}`)
    ])
  ].join('\n');

export const buildFeedback = async (ctx: RunContext, loaded: LoadedRun): Promise<string> =>
  feedbackText(await feedbackOf(ctx, loaded));

/**
 * The run's feedback, written in the project as its own Prettier writes it — the agents' words in it too: a file the run
 * leaves never fails the project's format check, which refuses the next run (lx-product). Where its Markdown is; its
 * JSON beside it.
 */
export const writeFeedback = async (ctx: RunContext, loaded: LoadedRun): Promise<string> => {
  const file = feedbackFile(ctx.root, loaded.record.runId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const format = await projectFormatter(ctx.root);
  const data = await feedbackOf(ctx, loaded);
  await fs.writeFile(file, await format(path.relative(ctx.root, file), `${feedbackText(data).trimEnd()}\n`));
  const json = file.replace(/\.md$/, '.json');
  // As Prettier leaves JSON, when the project has none to write it with.
  await fs.writeFile(json, await format(path.relative(ctx.root, json), formattedJson(data)));

  return file;
};
