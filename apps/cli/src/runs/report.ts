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
import { FINDING_OWNERS, factFindings, indicatorsOf, orderFindings, runFindings, scratchOf } from './findings';
import { harnessUsage } from './harness';
import { coverage } from './inventory';
import { requireLead } from './leads';
import { messagesOf } from './messages';
import { noticesByOwner, noticeText } from './notices';
import { taskPaths } from './paths';
import { RunRefusal } from './refusal';
import { flowText } from './reportFlow';
import { consumptionText, findingsText, glanceText, reviewsText, uiReviewsText } from './reportHead';
import { completionsOf, inputOf, loadRun, logRun, readApproved, readRunLog, requireNoTask, updateRecord } from './run';
import { harnessOf, runMetrics } from './runMetrics';
import { cachedShare, costInAll, costliestPieces, spentOf } from './spent';
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
  /** Its UI's review, in a run with a designer: who approved it, or that the lead approved without it. */
  design?: string;
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
  optionalString(value.reason);

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
    const approval = log.find(line => line.action === 'review' && line.task === task.id && line.verdict === 'approve');
    // A spike is a lead's: from its take, by the lead that found it out, to its end — said as one, not as a developer's.
    const spike = task.spike !== undefined;
    const first = spike ? log.find(line => line.action === 'spike-taken' && line.task === task.id) : takes.at(0);
    const ended = spike ? log.find(line => line.action === 'spike-done' && line.task === task.id) : approval;
    // Every designer that said a round of its UI, in order — one named alone hid the other (a run's t-match-bars).
    const designers = [
      ...new Set(log.filter(line => line.action === 'design-review' && line.task === task.id).map(line => line.by))
    ];
    tasks.push({
      id: task.id,
      title: task.title,
      kind: task.kind,
      role: spike ? 'lead (spike)' : (task.role ?? 'developer'),
      status: view.state.status,
      agents: spike ? (view.state.spikedBy ? [view.state.spikedBy.by] : []) : [...new Set(takes.map(line => line.by))],
      rounds: view.state.round,
      ...(view.state.design?.status === 'approved'
        ? {
            design: `UI by ${designers.length > 0 ? designers.join(', then ') : (view.state.design.by ?? 'a designer')}`
          }
        : view.state.design?.status === 'skipped'
          ? {
              design:
                view.state.design.why === 'lead'
                  ? 'UI by the lead'
                  : view.state.design.why === 'no-ui'
                    ? 'no UI'
                    : 'UI review skipped'
            }
          : {}),
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
      cuts: view.state.notes.filter(note => note.text.startsWith('Cut at')).length,
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
  const findings = orderFindings([
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
    ...factFindings(facts)
  ]);

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
    ...titles,
    '',
    'Each with its evidence and fix, and the flow, the cost and the bench: plitzi run report --full'
  ].join('\n');
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
    `${closing ? (closing.outcome === 'finished' ? 'Finished' : 'Aborted') : 'Going'} ${report.at} · opened ${report.openedAt} · ${report.metrics.workMinutes === undefined ? `${String(report.minutes)} min` : `worked ${String(report.metrics.workMinutes)} min, then ${String(report.metrics.afterMinutes ?? 0)} to this report`}, estimated ${String(report.estimate.wallMinutes)} with ${String(report.estimate.agents)} agents (${String(report.estimate.totalMinutes)} min of work)`,
    '',
    ...glanceText(report),
    '',
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
        `| ${task.id}${task.kind === 'integration' ? ' (integration)' : ''} | ${task.role} | ${task.status} | ${task.agents.join(', ') || '—'} | ${task.minutes === undefined ? '—' : String(task.minutes)} / ${String(task.estimateMinutes)} | ${String(task.rounds)}${task.design ? ` · ${task.design}` : ''} | ${String(task.cuts)} | ${task.files.join(', ') || '—'} |`
    ),
    '',
    ...(uiReviewsText(report.tasks).length > 0 ? [...uiReviewsText(report.tasks), ''] : []),
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
  await requireLead(ctx, loaded, 'write the run’s summary');
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
      `${file} is ${text === undefined ? 'not there' : 'empty'}: the summary is what the run did, what went wrong and what is left`
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
