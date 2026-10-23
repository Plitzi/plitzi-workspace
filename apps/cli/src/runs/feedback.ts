import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { noticesByOwner } from './notices';
import { ownScriptLines } from './ownScripts';
import { buildReport } from './report';
import { readRunLog } from './run';
import { commandName } from './runMetrics';
import { projectFormatter } from '../commands/projectFormatter';

import type { LoadedRun, RunContext } from './run';

/**
 * A run's feedback to Plitzi: what the run says of Plitzi itself — the CLI, the platform, the docs — as a document the
 * person shares with Plitzi's team, so a run on any project makes Plitzi better. Written as the run ends, beside the
 * project's team and backlog; never sent by itself. Nothing of the project in it — no code, no token, no path of the
 * person's machine — only how Plitzi behaved: what its agents noticed of it, where it refused or broke, the checks that
 * failed for nothing of the work, the calls made again and again, and the run's measures.
 */

export const FEEDBACK_DIR = path.join('.plitzi', 'feedback');

/** The feedback's file for a run, in the project. */
export const feedbackFile = (root: string, runId: string): string => path.join(root, FEEDBACK_DIR, `${runId}.md`);

/** A text with the person's machine left out: the project's folder and their home said as such, a token's secret cut. */
const sanitized = (root: string, text: string): string =>
  text
    .replaceAll(root, '<project>')
    .replaceAll(os.homedir(), '~')
    .replace(/\b[\w-]+\.(?:@[\w-]+|t-[\w-]+)\.[0-9a-f]{16,}\b/g, '<token>');

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

const section = (title: string, lines: readonly string[]): string[] =>
  lines.length === 0 ? [] : [`## ${title}`, '', ...lines, ''];

export const buildFeedback = async (ctx: RunContext, loaded: LoadedRun): Promise<string> => {
  const report = await buildReport(ctx, loaded);
  const { metrics } = report;
  const log = await readRunLog(loaded.paths);
  const ofPlitzi = (await noticesByOwner(loaded)).plitzi;
  const crashed = log.filter(entry => entry.action === 'crashed');
  const refusals = Object.entries(metrics.refusals.byCode).sort(([, a], [, b]) => b.times - a.times);
  const ownSteps = Object.entries(metrics.checks.byStep).sort(([, a], [, b]) => b - a);
  const text = [
    `# Plitzi feedback — run ${loaded.record.runId}`,
    '',
    `CLI ${loaded.record.pinned.cli} · ${report.openedAt.slice(0, 10)} · ${String(report.tasks.length)} tasks, ${String(metrics.agents.length)} agents · ${String(report.minutes)} min`,
    '',
    'What this run says of Plitzi itself — written by the CLI as the run ended, nothing of the project in it. Share it',
    'with Plitzi’s team: it is how a run on any project makes Plitzi better.',
    '',
    ...section(
      'Noticed of Plitzi, by the run’s agents (`run notice --plitzi`)',
      ofPlitzi.map(notice => `- ${notice.text}${notice.on ? ` (on ${notice.on})` : ''} — ${notice.by}`)
    ),
    ...section(
      'What the run’s activity shows went wrong in how it was worked',
      report.audit.map(line => `- ${line}`)
    ),
    // What the run checked with scripts of the lead's own: where Plitzi could not say it, or was not known to.
    ...section(
      'Acceptance checked by scripts of the lead’s own — a Plitzi command missing, or unknown',
      ownScriptLines(loaded.tasks).map(each => `- ${each.task}: ${each.scripts.join(', ')} — “${each.line}”`)
    ),
    ...section(
      'Refusals, by code',
      refusals.map(
        ([code, refused]) =>
          `- ${code} ×${String(refused.times)}${refused.command ? ` — e.g. ${commandName(refused.command)}` : ''} (${refused.by.join(', ')})`
      )
    ),
    ...section(
      'Commands that crashed',
      crashed.map(
        entry => `- ${commandName(textOf(entry.command))}: ${(textOf(entry.error).split('\n')[0] ?? '').slice(0, 200)}`
      )
    ),
    ...section('Checks', [
      `- ${String(metrics.checks.run)} task checks: ${String(metrics.checks.failed)} failed for the work, ${String(metrics.checks.notOwn)} for nothing of it (the run's own failures, a line nothing answered)`,
      ...ownSteps.map(([step, times]) => `  - ${step} ×${String(times)}`)
    ]),
    ...section(
      'Calls made again and again',
      metrics.cost.repeated.map(
        call => `- ${call.by}: ${commandName(call.command)} ×${String(call.times)} within ${String(call.within)} min`
      )
    ),
    ...section('The run, measured', [
      `- tasks ${String(report.tasks.length)}, rounds ${String(report.tasks.reduce((sum, task) => sum + task.rounds, 0))}, hand-offs ${String(metrics.handOffs)}, refusals ${String(metrics.refusals.total)}`,
      ...(metrics.workMinutes === undefined ? [] : [`- worked ${String(metrics.workMinutes)} min`])
    ])
  ].join('\n');

  return sanitized(ctx.root, text);
};

/**
 * The run's feedback, written in the project as its own Prettier writes it — the agents' words in it too: a file the run
 * leaves never fails the project's format check, which refuses the next run (lx-product). Where it is.
 */
export const writeFeedback = async (ctx: RunContext, loaded: LoadedRun): Promise<string> => {
  const file = feedbackFile(ctx.root, loaded.record.runId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const format = await projectFormatter(ctx.root);
  const text = `${(await buildFeedback(ctx, loaded)).trimEnd()}\n`;
  await fs.writeFile(file, await format(path.relative(ctx.root, file), text));

  return file;
};
