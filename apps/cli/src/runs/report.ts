import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { agentTimelines, timelinesText } from './agentTimeline';
import { proposalsOf } from './agreements';
import { auditRun } from './audit';
import { benchText, teamTasks } from './bench';
import { briefsOf } from './briefs';
import { combineExperience, experienceText, isExperience, saidOfPlitzi } from './experience';
import { readOptional, writeAtomic } from './files';
import {
  FINDING_OWNERS,
  closeFindings,
  factFindings,
  indicatorsOf,
  orderFindings,
  overrunFindings,
  pastFindingsOf,
  runFindings,
  scratchOf,
  withHistory
} from './findings';
import { harnessUsage } from './harness';
import { coverage } from './inventory';
import { requireLead } from './leads';
import { messagesOf } from './messages';
import { noticesByOwner, noticeText } from './notices';
import { taskPaths } from './paths';
import { RunRefusal } from './refusal';
import { applyFacts, applyText } from './reportApply';
import { flowText } from './reportFlow';
import { consumptionText, findingsText, glanceText, reviewsText, stepsSaidText } from './reportHead';
import { readRunReports } from './reports';
import {
  completionsOf,
  inputOf,
  isApproval,
  loadRun,
  logRun,
  readApproved,
  readRunLog,
  requireNoTask,
  updateRecord
} from './run';
import { harnessOf, runMetrics } from './runMetrics';
import { cachedShare, costInAll, costliestPieces, spentOf } from './spent';
import { roleOf } from './spike';
import { readTaskReports } from './taskReports';
import { requestsOf } from './tasks';
import { readReviewed, viewTask } from './taskStore';
import { readUsage } from './usage';
import { viewRun } from './view';

import type { AgentTimeline } from './agentTimeline';
import type { BenchLine } from './bench';
import type { Briefs } from './briefs';
import type { CombinedExperience, Experience } from './experience';
import type { Finding, RunIndicators } from './findings';
import type { HarnessUsage } from './harness';
import type { ApplyFacts } from './reportApply';
import type { LoadedRun, RunContext } from './run';
import type { RunMetrics } from './runMetrics';
import type { PieceCost } from './spent';
import type { TaskRoundReport } from './taskReports';

/**
 * A run's report: how the whole run went, put together from what it kept — each task's rounds as their agents completed
 * them (`taskReports.ts`), its log and usage — into the problems it shows, each with its evidence, whose it is and what
 * would stop it (`findings/`), what it spent, and the facts: each task's agents, time against its estimate, reviews and
 * cuts; refusals, failed checks and conflicts; requests and agreements. The lead adds only what no record says
 * (`plitzi run report --summary <file>`); the final merge does not go in without it. When the run ends, the report is
 * left in the project's reports with the run's records (`leaveReport.ts`): the run goes, the report stays.
 */

export interface TaskReport {
  id: string;
  title: string;
  kind: 'work' | 'integration';
  role: string;
  status: string;
  agents: string[];
  rounds: number;
  estimateMinutes: number;
  /** From its first take to its approval, or to now. */
  minutes?: number;
  files: string[];
  cuts: number;
  blocked?: string;
  knownFailure?: string;
  /** Each step of its review approved, in order, and who said it: `designer: design-1`, `tester: test-1`. */
  reviewedBy?: string[];
  /**
   * What each review asked when it sent the task back, by round and by whom: what tells the agent's mistake from what
   * Plitzi did not let it see (a run's eight sends-back were all logic: a race, a hole, a stale count).
   */
  reviews: { round: number; by: string; asked: string }[];
}

/** What a report's data is shaped as: what reads it across runs knows which it reads. */
export const REPORT_VERSION = 2;

export interface RunReport {
  version: typeof REPORT_VERSION;
  runId: string;
  goal: string;
  /** What the plan said the run leaves out. */
  leftOut: string[];
  /** The job, piece by piece, as the plan listed it: who covered each, or why it waits. */
  inventory: { id: string; piece: string; page?: string; by: string[]; leftOut?: string }[];
  openedAt: string;
  at: string;
  minutes: number;
  estimate: { wallMinutes: number; totalMinutes: number; agents: number };
  tasks: TaskReport[];
  events: { completed: number; refused: number; checksFailed: number; conflicts: number };
  overwrites: { file: string; task: string; by: string; at: string }[];
  /** Files a person changed while their task worked on them, put together with the task's change line by line. */
  joined: { file: string; task: string; by: string; at: string }[];
  requests: { file: string; task: string; summary: string; integratedBy?: string; integrated: boolean }[];
  proposals: { id: string; from: string; to: string; change: string; answer?: string }[];
  reconciliation?: { reason: string; files: { file: string; resolved?: string }[] };
  /** Each time it stopped and was resumed, with why. */
  stops: { at: string; reason: string; resumedAt?: string; by?: string }[];
  restores: { id: string; files: string[] }[];
  /**
   * What went wrong, each with its evidence, whose it is and what would stop it (`findings/`): the run's problems, read
   * off what it kept — the lead's summary adds only what no record says.
   */
  findings: Finding[];
  /** The findings as numbers, one a pattern: the bench's. */
  indicators: RunIndicators;
  /** What it was like to work with Plitzi: every round's and the lead's, combined (`experience.ts`). */
  experience: CombinedExperience;
  /** What was seen wrong that no task owned (`plitzi run notice`): where the next stage starts. */
  noticed: string[];
  /** Where its time went, what failed by step and code, and what it cost (`runMetrics.ts`): the bench's, as data. */
  metrics: RunMetrics;
  /** Each round of each task, as its agent completed it (`taskReports.ts`). */
  taskReports: TaskRoundReport[];
  /** What the lead's own sessions spent over the run, when its harness keeps one this CLI reads. */
  lead?: HarnessUsage;
  /** Each agent's life in the run: started, at work, waiting, stopped and why, silent (`agentTimeline.ts`). */
  agents: AgentTimeline[];
  /** What the agents' briefs weighed, part by part (`briefs.ts`): none when none was read. */
  briefs?: Briefs;
  /**
   * What every agent's harness spent — the lead's and the reviewers' too — as each piece of work ended (`spent`): what
   * it cost at the API's prices when every model has one, how much was its context read again, and the costliest pieces.
   * A run's report said tokens alone, and its $6.75 — a third of it one designer task — was read off its log by hand.
   */
  /** What the finish's dry run said, and the lines rewritten once their tasks were done: read before applying. */
  apply?: ApplyFacts;
  spend?: {
    cost?: number;
    cachedShare: number;
    byAgent: { agent: string; tokens: number; cost?: number }[];
    costliest: PieceCost[];
  };
}

interface LogLine {
  at: string;
  by: string;
  action: string;
  task?: string;
  kind?: string;
  verdict?: string;
  reason?: string;
  /** A review's: the role whose step it said. */
  step?: string;
  /** An approval's (its last step): what it put into the run's work. */
  merged?: unknown;
}

const optionalString = (value: unknown): boolean => value === undefined || typeof value === 'string';

const isLogLine = (value: unknown): value is LogLine =>
  isRecord(value) &&
  typeof value.at === 'string' &&
  typeof value.by === 'string' &&
  typeof value.action === 'string' &&
  optionalString(value.task) &&
  optionalString(value.kind) &&
  optionalString(value.verdict) &&
  optionalString(value.reason) &&
  optionalString(value.step);

const readLog = async (file: string): Promise<LogLine[]> => {
  const text = (await readOptional(file))?.toString('utf-8') ?? '';
  const lines: LogLine[] = [];
  for (const line of text.split('\n').filter(Boolean)) {
    try {
      const parsed: unknown = JSON.parse(line);
      if (isLogLine(parsed)) {
        lines.push(parsed);
      }
    } catch {
      // A line cut by a crash mid-append is the only one that does not parse: what it said is lost, the rest is not.
      continue;
    }
  }

  return lines;
};

const minutesBetween = (from: string, to: string): number => Math.round((Date.parse(to) - Date.parse(from)) / 60_000);

export const buildReport = async (ctx: RunContext, loaded: LoadedRun): Promise<RunReport> => {
  const now = ctx.now().toISOString();
  const log = await readLog(loaded.paths.log);
  const approved = await readApproved(loaded.paths);
  const tasks: TaskReport[] = [];
  for (const task of loaded.tasks) {
    const view = await viewTask(loaded.paths, task);
    const takes = log.filter(line => line.action === 'take' && line.task === task.id);
    const approval = log.find(line => line.task === task.id && isApproval(line));
    // A research card as any: from its take to its approval — the lead's own, found out untaken, ends as it is said
    // (`spike-done`).
    const first = takes.at(0);
    const ended = approval ?? log.find(line => line.action === 'spike-done' && line.task === task.id);
    // Every step of its reviews approved, in order, and who said it — one named alone hid the other (a run's
    // t-match-bars).
    const reviewedBy = log
      .filter(line => line.task === task.id && line.verdict === 'approve' && line.action === 'review')
      .map(line => `${line.step ?? 'review'}: ${line.by}`);
    tasks.push({
      id: task.id,
      title: task.title,
      kind: task.kind,
      role: roleOf(task),
      status: view.state.status,
      agents: [...new Set(takes.map(line => line.by))],
      rounds: view.state.round,
      ...(reviewedBy.length > 0 ? { reviewedBy } : {}),
      estimateMinutes: task.estimateMinutes,
      ...(first ? { minutes: minutesBetween(first.at, ended?.at ?? now) } : {}),
      // What it changed: what it completed with, and what the run holds of it — a shared file it took by turns and
      // another task changed after it is still one it wrote.
      files: [
        ...new Set([
          ...(view.state.status === 'done' ? (view.state.changed ?? []) : []),
          ...Object.entries(approved.files)
            .filter(([, entry]) => entry.task === task.id)
            .map(([file]) => file)
        ])
      ].sort(),
      cuts: view.state.notes.filter(note => note.kind === 'cut').length,
      reviews: view.state.notes.flatMap(note => {
        const [, round, asked] = /^Review (\d+): ([\s\S]*)$/.exec(note.text) ?? [];

        return round && asked ? [{ round: Number(round), by: note.by, asked }] : [];
      }),
      ...(view.state.knownFailure
        ? { knownFailure: `${view.state.knownFailure.failing.join(', ')} failing: ${view.state.knownFailure.why}` }
        : {}),
      ...(view.state.blockedBy ? { blocked: `${view.state.blockedBy.reason} (${view.state.blockedBy.needs})` } : {})
    });
  }

  const completions = completionsOf(loaded.record, log);
  const events = {
    completed: completions.completed,
    refused: completions.refused,
    checksFailed: completions['checks-failed'],
    conflicts: completions.conflict
  };
  const overwrites = Object.entries(approved.files).flatMap(([file, entry]) =>
    entry.overrode ? [{ file, task: entry.task, by: entry.overrode.by, at: entry.overrode.at }] : []
  );
  const joined = Object.entries(approved.files).flatMap(([file, entry]) =>
    entry.joined ? [{ file, task: entry.task, by: entry.joined.by, at: entry.joined.at }] : []
  );
  const requests = (await requestsOf(loaded)).map(each => ({
    file: each.request.file,
    task: each.task,
    summary: each.request.summary,
    ...(each.integratedBy ? { integratedBy: each.integratedBy } : {}),
    integrated: each.integrated
  }));
  const proposals = (await proposalsOf(loaded)).map(each => ({
    id: each.id,
    from: each.from,
    to: each.to,
    change: each.change,
    ...(each.answer ? { answer: `${each.answer.verdict}${each.answer.note ? `: ${each.answer.note}` : ''}` } : {})
  }));
  const stops: RunReport['stops'] = [];
  for (const line of log) {
    if (line.action === 'brake' || line.action === 'stop') {
      stops.push({
        at: line.at,
        reason: line.action === 'brake' ? `the automatic brake: ${String(line.reason)}` : `stopped by ${line.by}`
      });
    } else if (line.action === 'resume') {
      const open = stops.findLast(stop => stop.resumedAt === undefined);
      if (open) {
        open.resumedAt = line.at;
        open.by = line.by;
      }
    }
  }

  const { record } = loaded;
  const minutes = minutesBetween(record.openedAt, now);
  const notices = await noticesByOwner(loaded);
  const runLog = await readRunLog(loaded.paths);
  const usage = readUsage(loaded.paths.dir);
  const taskReports = await readTaskReports(loaded);
  const metrics = runMetrics({
    log: runLog,
    usage,
    answers: (await messagesOf(loaded)).flatMap(message =>
      message.replyTo === undefined ? [] : [{ replyTo: message.replyTo, at: message.at }]
    ),
    harness: harnessOf(taskReports),
    taskIds: loaded.tasks.map(task => task.id),
    openedAt: record.openedAt,
    now
  });
  const spent = spentOf(runLog, usage);
  const runCost = costInAll(spent);
  const leads = usage.filter(line => line.by.startsWith('lead'));
  const lead = await harnessUsage({
    sessions: [...new Set(leads.flatMap(line => (line.session ? [line.session] : [])))],
    processes: [...new Set(leads.flatMap(line => (line.process ? [line.process] : [])))],
    root: ctx.root,
    from: record.openedAt,
    to: now
  });
  const leadExperience = await readLeadExperience(loaded);
  const experience = combineExperience(taskReports, leadExperience);
  const facts = { tasks, events, overwrites, joined, stops, proposals, minutes, estimate: record.estimate };
  // Held against the runs before: new, or met again.
  const findings = withHistory(
    orderFindings([
      ...runFindings({
        log: runLog,
        usage,
        tasks: loaded.tasks,
        said: saidOfPlitzi(
          notices.plitzi,
          taskReports,
          leadExperience ? { experience: leadExperience, at: now } : undefined
        ),
        scratch: await scratchOf(loaded.paths.scratch),
        taskReports,
        repeated: metrics.cost.repeated
      }),
      ...(await auditRun(loaded)),
      ...factFindings({ ...facts, metrics }),
      ...overrunFindings(facts.tasks, runLog),
      ...closeFindings(runLog, now)
    ]),
    pastFindingsOf(await readRunReports(ctx.root), record.runId, now)
  );

  return {
    version: REPORT_VERSION,
    runId: record.runId,
    goal: loaded.plan.goal,
    leftOut: loaded.plan.leftOut ?? [],
    inventory: coverage(loaded.plan, loaded.tasks).map(({ item, by }) => ({ ...item, by })),
    openedAt: record.openedAt,
    at: now,
    minutes,
    estimate: {
      wallMinutes: record.estimate.wallMinutes,
      totalMinutes: record.estimate.totalMinutes,
      agents: record.estimate.agents
    },
    tasks,
    events,
    apply: applyFacts(runLog),
    stops,
    overwrites,
    joined,
    requests,
    proposals,
    ...(spent.length > 0
      ? {
          spend: {
            ...(runCost === undefined ? {} : { cost: runCost }),
            cachedShare: cachedShare(spent),
            byAgent: spent.map(each => ({
              agent: each.agent,
              tokens: each.input + each.output + each.cached,
              ...(each.cost === undefined ? {} : { cost: each.cost })
            })),
            costliest: costliestPieces(runLog, 5)
          }
        }
      : {}),
    ...(record.reconciliation
      ? {
          reconciliation: {
            reason: record.reconciliation.reason,
            files: record.reconciliation.files.map(file => ({
              file: file.file,
              ...(file.resolved ? { resolved: file.resolved } : {})
            }))
          }
        }
      : {}),
    restores: record.merges
      .filter(merge => merge.kind === 'restore')
      .map(merge => ({ id: merge.id, files: Object.keys(merge.files) })),
    findings,
    indicators: indicatorsOf(
      findings,
      metrics,
      taskReports,
      teamTasks(tasks).filter(task => task.status === 'done').length,
      experience.ease.median
    ),
    experience,
    noticed: notices.project.map(noticeText),
    metrics,
    taskReports,
    ...(lead ? { lead } : {}),
    // To the last approval: past it every agent waits for the person's finish (595 min "at work or waiting").
    agents: agentTimelines(runLog, workEndOf(runLog) ?? ctx.now()),
    ...(briefsOf(runLog) ? { briefs: briefsOf(runLog) } : {})
  };
};

export interface Closing {
  outcome: 'finished' | 'aborted';
  /** Finished: what was written into the project. Aborted: what was discarded. */
  files: string[];
  backup?: string;
  /** Finished: who wrote it — a person, or the lead as a person allowed it then. */
  writtenBy?: string;
}

const lines = (items: readonly string[], none: string): string[] =>
  items.length > 0 ? items.map(item => `- ${item}`) : [`- ${none}`];

/** A report as a person reads it: the lead's summary first, then the facts. */
const workEndOf = (log: readonly Record<string, unknown>[]): Date | undefined => {
  const approved = log.findLast(entry => entry.action === 'all-approved');

  return typeof approved?.at === 'string' ? new Date(approved.at) : undefined;
};

/**
 * The run's goal grows by a stage's at each `run extend` (`extend.ts`): the title is the run's own, the stages a list
 * under it — a run's title was 16 goals in one line.
 */
const goalText = (runId: string, goal: string): string[] => {
  const [own, ...stages] = goal.split(' · ');

  return [
    `# Run "${runId}" — ${own}`,
    ...(stages.length > 0 ? ['', 'Its stages, as they were stacked:', '', ...stages.map(stage => `- ${stage}`)] : [])
  ];
};

/** The lead's summary sits under a heading of the report's: its own headings go two levels down. */
const nestedHeadings = (text: string): string =>
  text.replace(/^(#{1,4}) /gm, (_match, hashes: string) => `${hashes}## `);

/**
 * The report as a command prints it: the run at a glance and each finding's title — the evidence, the flow and the
 * cost are the whole report's (`--full`, and the file a finish writes). A run's lead read 112k characters of it.
 */
export const reportBrief = (report: RunReport): string => {
  const titles = FINDING_OWNERS.flatMap(owner => {
    const theirs = report.findings.filter(finding => finding.owner === owner);

    return theirs.length === 0
      ? []
      : [
          '',
          `${owner} (${String(theirs.length)}):`,
          ...theirs.map(finding => `- ${finding.title}${finding.times > 1 ? ` ×${String(finding.times)}` : ''}`)
        ];
  });

  return [
    ...goalText(report.runId, report.goal).slice(0, 1),
    '',
    ...glanceText(report),
    '',
    // What a person decides applying it on, before the problems: a run's asked the lead for it by hand.
    ...applyText(report, false),
    ...titles,
    '',
    'Each with its evidence and fix, and the flow, the cost and the bench: plitzi run report --full'
  ].join('\n');
};

/** The run's time: its work, the lead's close, and the person's wait to apply — each apart. */
export const timeText = (metrics: RunReport['metrics'], total: number): string => {
  if (metrics.workMinutes === undefined) {
    return `${String(total)} min`;
  }

  const after = metrics.afterMinutes ?? 0;

  return metrics.closeMinutes === undefined
    ? `worked ${String(metrics.workMinutes)} min, then ${String(after)} to this report`
    : `worked ${String(metrics.workMinutes)} min, ready to apply ${String(metrics.closeMinutes)} min after the last approval (the lead's close), then ${String(Math.round((after - metrics.closeMinutes) * 10) / 10)} to this report (the person's)`;
};

export const reportText = (
  report: RunReport,
  summary: string | undefined,
  closing?: Closing,
  /** The runs measured before this one, and it last: the bench the report ends its flow with. */
  benchBefore?: readonly BenchLine[]
): string =>
  [
    ...goalText(report.runId, report.goal),
    '',
    `${closing ? (closing.outcome === 'finished' ? 'Finished' : 'Aborted') : 'Going'} ${report.at} · opened ${report.openedAt} · ${timeText(report.metrics, report.minutes)}, estimated ${String(report.estimate.wallMinutes)} with ${String(report.estimate.agents)} agents (${String(report.estimate.totalMinutes)} min of work)`,
    '',
    ...glanceText(report),
    '',
    ...applyText(report, closing?.outcome === 'finished'),
    '## Problems — whose, and what would stop them',
    '',
    ...findingsText(report.findings),
    '## Using Plitzi — what it was like, every round’s and the lead’s',
    '',
    ...experienceText(report.experience),
    '## The lead’s summary',
    '',
    summary === undefined
      ? '_None was written: the problems above are what the run kept._'
      : nestedHeadings(summary.trim()),
    '',
    ...(report.leftOut.length > 0
      ? ['## Left out, as the plan said', '', ...report.leftOut.map(line => `- ${line}`), '']
      : []),
    ...(report.noticed.length > 0
      ? [
          '## Noticed, owned by no task',
          '',
          ...report.noticed.map(line => `- ${line}`),
          '- — what the next stage or run starts from (plitzi run extend)',
          ''
        ]
      : []),
    ...(report.inventory.length > 0
      ? [
          '## The job, piece by piece',
          '',
          ...report.inventory.map(
            item =>
              `- ${item.piece}${item.page ? ` (${item.page})` : ''}: ${item.leftOut === undefined ? `covered by ${item.by.join(', ')}` : `left out — ${item.leftOut}`}`
          ),
          ''
        ]
      : []),
    '## Tasks',
    '',
    '| Task | Role | Status | Agents | Time / estimate (min) | Reviews | Cuts | Files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...report.tasks.map(
      task =>
        `| ${task.id}${task.kind === 'integration' ? ' (integration)' : ''} | ${task.role} | ${task.status} | ${task.agents.join(', ') || '—'} | ${task.minutes === undefined ? '—' : String(task.minutes)} / ${String(task.estimateMinutes)} | ${String(task.rounds)}${task.reviewedBy ? ` · ${task.reviewedBy.join(' → ')}` : ''} | ${String(task.cuts)} | ${task.files.join(', ') || '—'} |`
    ),
    '',
    ...(stepsSaidText(report.tasks).length > 0 ? [...stepsSaidText(report.tasks), ''] : []),
    ...reviewsText(report),
    ...timelinesText(report.agents),
    ...consumptionText(report),
    ...flowText(report.metrics),
    ...(benchBefore && benchBefore.length > 0 ? ['## Against the runs before', '', ...benchText(benchBefore), ''] : []),
    '## What happened',
    '',
    `- Completions: ${String(report.events.completed)}; completions refused for another task's files: ${String(report.events.refused)}; completions whose checks failed: ${String(report.events.checksFailed)}; conflicts: ${String(report.events.conflicts)}`,
    ...report.overwrites.map(
      each => `- Written over a change made outside the run: ${each.file} (${each.task}, decided by ${each.by})`
    ),
    ...report.joined.map(
      each => `- Merged with a change made outside the run: ${each.file} (${each.task}, decided by ${each.by})`
    ),
    ...report.requests.map(
      each =>
        `- Request on ${each.file} from ${each.task}: ${each.summary} — ${each.integrated ? `integrated by ${String(each.integratedBy)}` : 'not integrated'}`
    ),
    ...report.proposals.map(
      each => `- Proposal ${each.id}, ${each.from} → ${each.to}: ${each.change} — ${each.answer ?? 'unanswered'}`
    ),
    ...(report.reconciliation
      ? [
          `- Reconciliation (${report.reconciliation.reason}): ${report.reconciliation.files.map(file => `${file.file} → ${file.resolved ?? 'unresolved'}`).join(', ')}`
        ]
      : []),
    ...report.restores.map(each => `- Restored from a backup (${each.id}): ${each.files.join(', ')}`),
    ...(closing
      ? [
          '',
          closing.outcome === 'finished' ? '## Written into the project' : '## Discarded',
          '',
          ...(closing.writtenBy ? [`Written by ${closing.writtenBy}.`, ''] : []),
          ...lines(closing.files, 'nothing'),
          ...(closing.backup ? ['', `The files as they were before: \`${closing.backup}\``] : [])
        ]
      : []),
    ''
  ].join('\n');

/**
 * `plitzi run report --summary <file> --ease --hardest …`: the lead's report of the run — its summary, and what it was
 * like to work with Plitzi, as each agent said its rounds' — kept for the run's report and its feedback.
 */
/** What waits on the run's keeper, not on the lead: an agent to start. */
const KEEPER_KINDS: ReadonlySet<string> = new Set(['agents-needed']);

export const writeSummary = async (
  ctx: RunContext,
  runId: string,
  file: string,
  experience: Experience
): Promise<void> => {
  requireNoTask(ctx, 'write the run’s summary');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, 'write the run’s summary');
  // The lead closes what it was told first: a run that ended with notices standing read as one whose lead ignored them
  // (ten), and a lead that said "done" before them stacked a stage after. Starting agents is the keeper's.
  const view = await viewRun(ctx, runId);
  const open = view.attention.filter(item => item.who === 'lead' && !KEEPER_KINDS.has(item.kind));
  if (view.done === view.total && open.length > 0) {
    throw new RunRefusal(
      'invalid',
      `The run is not the lead's to close yet — ${String(open.length)} thing${open.length === 1 ? '' : 's'} wait${open.length === 1 ? 's' : ''} for you: ${open.map(item => item.text.split('\n')[0]).join(' · ')}. Settle each (review, answer, amend, a stage of its own), then close: plitzi run report --summary ${file}`,
      { open: open.map(item => item.kind) }
    );
  }

  const text = (await readOptional(path.resolve(ctx.root, file)))?.toString('utf-8');
  if (text === undefined || text.trim() === '') {
    throw new RunRefusal(
      'invalid',
      // A summary written on the command line read "<its words> is not there" (the CLI's sanity run): said as a file.
      `--summary names a file, and ${file} is ${text === undefined ? 'no file' : 'empty'}: write the summary — what the run did, what went wrong and what is left — in a markdown file of your scratch, and name it: plitzi run report --summary <file>`
    );
  }

  await writeAtomic(loaded.paths.summary, text);
  await writeAtomic(loaded.paths.leadExperience, `${JSON.stringify(experience, null, 2)}\n`);
  await logRun(ctx, loaded.paths, { action: 'summary' });
  const input = await inputOf(ctx, path.resolve(ctx.root, file));
  if (input) {
    await updateRecord(ctx, loaded.paths, record => ({
      ...record,
      inputs: [...record.inputs.filter(each => each.file !== input.file), input]
    }));
  }
};

export const readSummary = async (loaded: LoadedRun): Promise<string | undefined> =>
  (await readOptional(loaded.paths.summary))?.toString('utf-8');

/** What it was like for the lead, as it said it with its summary — none before it was said. */
export const readLeadExperience = async (loaded: LoadedRun): Promise<Experience | undefined> => {
  const text = (await readOptional(loaded.paths.leadExperience))?.toString('utf-8');
  if (text === undefined) {
    return undefined;
  }

  try {
    const read: unknown = JSON.parse(text);

    return isExperience(read) ? read : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The tasks approved after the lead's summary was written: what the report says nothing of — or says wrong (* "the morph is left out", written before t-morph was approved). When it was written is its `summary` entry in the log;
 * a run whose summary came before that entry was kept is read by its file's time, the same clock its approvals have.
 */
export const summaryBehind = async (loaded: LoadedRun): Promise<string[]> => {
  const written =
    (await readRunLog(loaded.paths)).findLast(entry => entry.action === 'summary')?.at ??
    (await fs.stat(loaded.paths.summary).catch(() => undefined))?.mtime.toISOString();
  if (typeof written !== 'string') {
    return [];
  }

  // A done task's reviewed version is the one approved: when it was is when the task was.
  const approved = await Promise.all(
    loaded.tasks.map(async task => ({
      id: task.id,
      at:
        (await viewTask(loaded.paths, task)).state.status === 'done'
          ? (await readReviewed(taskPaths(loaded.paths, task.id)))?.at
          : undefined
    }))
  );

  return approved.flatMap(each => (each.at !== undefined && each.at > written ? [each.id] : []));
};
