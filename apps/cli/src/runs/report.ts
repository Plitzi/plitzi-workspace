import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { proposalsOf } from './agreements';
import { auditRun } from './audit';
import { benchOf, benchText, readBench } from './bench';
import { readOptional, writeAtomic } from './files';
import { rememberPace } from './history';
import { coverage } from './inventory';
import { requireLead } from './leads';
import { messagesOf } from './messages';
import { noticesByOwner, noticeText } from './notices';
import { REPORTS_DIR, taskPaths } from './paths';
import { RunRefusal } from './refusal';
import { flowText } from './reportFlow';
import { completionsOf, inputOf, loadRun, logRun, readApproved, readRunLog, requireNoTask, updateRecord } from './run';
import { runMetrics } from './runMetrics';
import { requestsOf } from './tasks';
import { readReviewed, viewTask } from './taskStore';
import { readUsage } from './usage';

import type { BenchLine } from './bench';
import type { LoadedRun, RunContext } from './run';
import type { RunMetrics } from './runMetrics';

/**
 * A run's report: how the whole run went. The CLI gathers what it knows — each task's agents, time against
 * its estimate, review rounds and cuts; every refusal, failed check and conflict; what was written over a change made
 * outside the run; requests and agreements — and the lead, who closes the run, writes the summary and the
 * problems on top (`plitzi run report --summary <file>`). The final merge does not go in without it. When the run ends,
 * the report is left in `tmp/plitzi-reports/`: the run goes, the report stays.
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
}

export interface RunReport {
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
  /** What went wrong or needs a look, read off the facts: the lead's summary says the rest. */
  problems: string[];
  /** What the run's activity shows was wrong in how it was worked (`audit.ts`): the CLI's to fix, or the team's. */
  audit: string[];
  /** What was seen wrong that no task owned (`plitzi run notice`): where the next stage starts. */
  noticed: string[];
  /** What its agents said of Plitzi itself (`run notice --plitzi`): the run's feedback carries it. */
  ofPlitzi: string[];
  /** Where its time went, what failed by step and code, and what it cost (`runMetrics.ts`): the bench's, as data. */
  metrics: RunMetrics;
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
    // Every designer that said a round of its UI, in order — one named alone hid the other (velada-polish's t-match-bars).
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
  const metrics = runMetrics({
    log: await readRunLog(loaded.paths),
    usage: readUsage(loaded.paths.dir),
    answers: (await messagesOf(loaded)).flatMap(message =>
      message.replyTo === undefined ? [] : [{ replyTo: message.replyTo, at: message.at }]
    ),
    tokens: await readTokens(loaded),
    taskIds: loaded.tasks.map(task => task.id),
    openedAt: record.openedAt,
    now
  });
  const problems = [
    ...tasks.filter(task => task.status !== 'done').map(task => `${task.id} did not finish: ${task.status}`),
    ...tasks.filter(task => task.blocked).map(task => `${task.id} was blocked: ${String(task.blocked)}`),
    ...tasks.filter(task => task.rounds > 1).map(task => `${task.id} took ${String(task.rounds)} reviews`),
    ...tasks
      .filter(task => task.cuts > 0)
      .map(task => `${task.id} was cut ${String(task.cuts)} time(s) and started again`),
    ...tasks
      .filter(task => task.minutes !== undefined && task.minutes > task.estimateMinutes * 2)
      .map(task => `${task.id} took ${String(task.minutes)} min of an estimated ${String(task.estimateMinutes)}`),
    ...(events.checksFailed > 0 ? [`The project’s checks failed ${String(events.checksFailed)} time(s)`] : []),
    ...(events.refused > 0
      ? [`${String(events.refused)} completion(s) refused for files that were not the task's`]
      : []),
    ...(events.conflicts > 0 ? [`${String(events.conflicts)} conflict(s)`] : []),
    ...overwrites.map(each => `${each.file} was written over a change made outside the run (decided by ${each.by})`),
    ...joined.map(
      each => `${each.file} was changed outside the run too: both changes kept, line by line (decided by ${each.by})`
    ),
    ...stops.map(
      stop =>
        `The run stopped at ${stop.at} (${stop.reason})${stop.resumedAt ? `, resumed by ${String(stop.by)} at ${stop.resumedAt}` : ''}`
    ),
    ...proposals.filter(each => each.answer === undefined).map(each => `${each.id} was never answered`),
    ...(minutes > record.estimate.wallMinutes * 1.5
      ? [`The run took ${String(minutes)} min of an estimated ${String(record.estimate.wallMinutes)}`]
      : [])
  ];

  return {
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
    problems: [
      ...problems,
      ...(metrics.checks.failed > 0
        ? [
            `${String(metrics.checks.failed)} of ${String(metrics.checks.run)} task checks failed — ${Object.entries(
              metrics.checks.byStep
            )
              .map(([step, times]) => `${step} ${String(times)}`)
              .join(', ')}`
          ]
        : []),
      ...(metrics.refusals.total > 0 ? [`${String(metrics.refusals.total)} command(s) refused (see Flow)`] : []),
      ...metrics.cost.repeated.map(
        each => `${each.by} ran \`${each.command}\` ${String(each.times)} times in ${String(each.within)} min`
      )
    ],
    audit: await auditRun(loaded),
    noticed: notices.project.map(noticeText),
    ofPlitzi: notices.plitzi.map(noticeText),
    metrics
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
export const reportText = (
  report: RunReport,
  summary: string | undefined,
  closing?: Closing,
  /** The runs measured before this one, and it last: the bench the report ends its flow with. */
  benchBefore?: readonly BenchLine[]
): string =>
  [
    `# Run "${report.runId}" — ${report.goal}`,
    '',
    `${closing ? (closing.outcome === 'finished' ? 'Finished' : 'Aborted') : 'Going'} ${report.at} · opened ${report.openedAt} · ${report.metrics.workMinutes === undefined ? `${String(report.minutes)} min` : `worked ${String(report.metrics.workMinutes)} min, then ${String(report.metrics.afterMinutes ?? 0)} to this report`}, estimated ${String(report.estimate.wallMinutes)} with ${String(report.estimate.agents)} agents (${String(report.estimate.totalMinutes)} min of work)`,
    '',
    '## The lead’s summary',
    '',
    summary?.trim() ?? '_None was written._',
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
    ...(report.ofPlitzi.length > 0
      ? [
          '## Noticed of Plitzi',
          '',
          ...report.ofPlitzi.map(line => `- ${line}`),
          '- — the run’s feedback to Plitzi carries it, written as the run ends',
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
    '## Problems',
    '',
    ...lines(report.problems, 'none found in what the CLI saw'),
    '',
    '## What the activity shows (audit)',
    '',
    ...lines(report.audit, 'nothing out of place in the run’s activity'),
    '',
    '## Tasks',
    '',
    '| Task | Role | Status | Agents | Time / estimate (min) | Reviews | Cuts | Files |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...report.tasks.map(
      task =>
        `| ${task.id}${task.kind === 'integration' ? ' (integration)' : ''} | ${task.role} | ${task.status} | ${task.agents.join(', ') || '—'} | ${task.minutes === undefined ? '—' : String(task.minutes)} / ${String(task.estimateMinutes)} | ${String(task.rounds)}${task.design ? ` · ${task.design}` : ''} | ${String(task.cuts)} | ${task.files.join(', ') || '—'} |`
    ),
    '',
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

/** `plitzi run report --summary <file>`: the lead's summary of the run, kept for its report. */
export const writeSummary = async (ctx: RunContext, runId: string, file: string): Promise<void> => {
  requireNoTask(ctx, 'write the run’s summary');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, loaded, 'write the run’s summary');
  const text = (await readOptional(path.resolve(ctx.root, file)))?.toString('utf-8');
  if (text === undefined || text.trim() === '') {
    throw new RunRefusal(
      'invalid',
      `${file} is ${text === undefined ? 'not there' : 'empty'}: the summary is what the run did, what went wrong and what is left`
    );
  }

  await writeAtomic(loaded.paths.summary, text);
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

/**
 * The tasks approved after the lead's summary was written: what the report says nothing of — or says wrong (la-velada:
 * "the morph is left out", written before t-morph was approved). When it was written is its `summary` entry in the log;
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

/** Leaves the report of a run that ends, out of the run: `tmp/plitzi-reports/<run>-<time>.md`. */
export const leaveReport = async (ctx: RunContext, loaded: LoadedRun, closing: Closing): Promise<string> => {
  const report = await buildReport(ctx, loaded);
  const stamp = ctx
    .now()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z');
  const file = path.join(ctx.root, REPORTS_DIR, `${loaded.record.runId}-${stamp}.md`);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const bench = benchOf(report, ctx.cli);
  const before = await readBench(ctx.root);
  await writeAtomic(file, reportText(report, await readSummary(loaded), closing, [...before.slice(-5), bench]));
  // Beside it, the same as data: what `plitzi run bench` compares, and a lead debugging the run reads whole.
  await writeAtomic(file.replace(/\.md$/, '.json'), `${JSON.stringify({ bench, report }, null, 2)}\n`);
  // This machine's pace too: what the next first run of any project scales its estimates by.
  await rememberPace(report.tasks);

  return file;
};

const tokensFile = (loaded: LoadedRun): string => path.join(loaded.paths.dir, 'tokens.json');

/** What the harness counted each agent spent, as the lead said it (`run report --tokens`). */
export const readTokens = async (loaded: LoadedRun): Promise<Record<string, number>> => {
  const read: unknown = await fs
    .readFile(tokensFile(loaded), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);

  return isRecord(read)
    ? Object.fromEntries(
        Object.entries(read).flatMap(([agent, value]) => (typeof value === 'number' ? [[agent, value]] : []))
      )
    : {};
};

/**
 * `run report --tokens dev-1=208061,design-2=261010`: the harness's own count of each agent's tokens, said by the lead,
 * who is handed it — the CLI sees only what it printed. Kept with the run, each agent's last said.
 */
export const writeTokens = async (ctx: RunContext, runId: string, said: string): Promise<Record<string, number>> => {
  requireNoTask(ctx, 'say what the agents spent');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, loaded, 'say what the agents spent');
  const pairs = said
    .split(',')
    .map(each => each.trim())
    .filter(Boolean);
  const parsed = pairs.map(pair => /^([a-z][a-z0-9_-]*)=(\d+)$/.exec(pair));
  const wrong = pairs.filter((_, index) => parsed[index] === null);
  if (wrong.length > 0 || pairs.length === 0) {
    throw new RunRefusal(
      'invalid',
      `--tokens is agent=count, separated by commas (dev-1=208061,design-2=261010)${wrong.length > 0 ? `: not ${wrong.join(', ')}` : ''}`
    );
  }

  const tokens = {
    ...(await readTokens(loaded)),
    ...Object.fromEntries(parsed.flatMap(match => (match ? [[match[1], Number(match[2])]] : [])))
  };
  await writeAtomic(tokensFile(loaded), `${JSON.stringify(tokens, null, 2)}\n`);
  await logRun(ctx, loaded.paths, { action: 'tokens', agents: Object.keys(tokens) });

  return tokens;
};
