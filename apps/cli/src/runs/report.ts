import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { proposalsOf } from './agreements';
import { readOptional, writeAtomic } from './files';
import { REPORTS_DIR } from './paths';
import { RunRefusal } from './refusal';
import { inputOf, loadRun, readApproved, requireNoTask, updateRecord } from './run';
import { requestsOf } from './tasks';
import { viewTask } from './taskStore';

import type { LoadedRun, RunContext } from './run';

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
    const first = takes.at(0);
    tasks.push({
      id: task.id,
      title: task.title,
      kind: task.kind,
      role: task.role ?? 'developer',
      status: view.state.status,
      agents: [...new Set(takes.map(line => line.by))],
      rounds: view.state.round,
      ...(view.state.design?.status === 'approved'
        ? { design: `UI by ${view.state.design.by ?? 'a designer'}` }
        : view.state.design?.status === 'skipped'
          ? { design: 'UI skipped' }
          : {}),
      estimateMinutes: task.estimateMinutes,
      ...(first ? { minutes: minutesBetween(first.at, approval?.at ?? now) } : {}),
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

  const count = (kind: string): number => log.filter(line => line.action === 'event' && line.kind === kind).length;
  const events = {
    completed: count('completed'),
    refused: count('refused'),
    checksFailed: count('checks-failed'),
    conflicts: count('conflict')
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
    problems
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
export const reportText = (report: RunReport, summary: string | undefined, closing?: Closing): string =>
  [
    `# Run "${report.runId}" — ${report.goal}`,
    '',
    `${closing ? (closing.outcome === 'finished' ? 'Finished' : 'Aborted') : 'Going'} ${report.at} · opened ${report.openedAt} · ${String(report.minutes)} min, estimated ${String(report.estimate.wallMinutes)} with ${String(report.estimate.agents)} agents (${String(report.estimate.totalMinutes)} min of work)`,
    '',
    '## The lead’s summary',
    '',
    summary?.trim() ?? '_None was written._',
    '',
    '## Problems',
    '',
    ...lines(report.problems, 'none found in what the CLI saw'),
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
    '## What happened',
    '',
    `- Completions: ${String(report.events.completed)}; refused: ${String(report.events.refused)}; checks failed: ${String(report.events.checksFailed)}; conflicts: ${String(report.events.conflicts)}`,
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
  const text = (await readOptional(path.resolve(ctx.root, file)))?.toString('utf-8');
  if (text === undefined || text.trim() === '') {
    throw new RunRefusal(
      'invalid',
      `${file} is ${text === undefined ? 'not there' : 'empty'}: the summary is what the run did, what went wrong and what is left`
    );
  }

  await writeAtomic(loaded.paths.summary, text);
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
  await writeAtomic(file, reportText(report, await readSummary(loaded), closing));

  return file;
};
