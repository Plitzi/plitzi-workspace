import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { durationText, FOLLOW_MS } from '../../../options';
import { ensureKeeper, keepAgents } from '../../../runs/agents/keeper';
import { waitForLead } from '../../../runs/agents/leadWatch';
import { showVersion } from '../../../runs/copies/merge';
import { copyRunWork, startPreview, startTaskPreview } from '../../../runs/copies/preview';
import { readOptional } from '../../../runs/core/files';
import { runPaths } from '../../../runs/core/paths';
import { isRunRefusal, RunRefusal } from '../../../runs/core/refusal';
import { amendKeptRun } from '../../../runs/report/amend';
import { benchText, readBench } from '../../../runs/report/bench';
import { experienceFrom } from '../../../runs/report/experience';
import {
  buildReport,
  keepSummary,
  readSummary,
  reportBrief,
  reportText,
  writeSummary
} from '../../../runs/report/report';
import { activeRuns, loadRun, pruneRuns } from '../../../runs/run';
import { LEAD } from '../../../runs/talk/messages';
import { runsState, viewRun } from '../../../runs/view/view';
import { boardLines, runText } from '../../../runs/view/viewText';
import { projectRun } from '../../../scaffold/packageManager';
import { act, contextFor, finishedRun, runOf } from '../shell';

import type { ExperienceFlags } from '../../../runs/report/experience';
import type { RunCommandOptions } from '../shell';

/**
 * A run as it goes: its state and status, watched — for the lead, until something needs it — what awaits applying,
 * one run's record, its report and its preview.
 */

/** Every run not yet written into the project, ready ones first: what `run status` says with none open, or `--all`. */
const runsText = (runs: Awaited<ReturnType<typeof runsState>>): string =>
  runs.length === 0
    ? 'No run of this project is waiting to be written into it.'
    : runs
        .map(run =>
          run.ready
            ? `${chalk.green('ready')} ${run.runId} — ${run.goal} (${String(run.done)} of ${String(run.total)} done)\n  ${run.leadFinishes ? 'the lead may apply it, as you allowed — or you: ' : 'apply it, in your terminal: '}${run.apply}`
            : `${chalk.yellow(run.status)} ${run.runId} — ${run.goal} (${String(run.done)} of ${String(run.total)} done${run.activeOn ? `, on ${run.activeOn}` : ', released'}${run.attention > 0 ? `, ${String(run.attention)} needing attention` : ''}): plitzi run status ${run.runId}`
        )
        .join('\n');

/**
 * `plitzi run status`: a run at a glance — or, with none open, several, or `--all`, every run not yet written into the
 * project (what `run status --all` was, beside it).
 */
export const runStatus = (runId: string | undefined, options: RunCommandOptions & { all?: boolean }): Promise<void> =>
  act(
    options,
    async ctx =>
      runId === undefined &&
      options.run === undefined &&
      (options.all === true || (await activeRuns(ctx.root)).length !== 1)
        ? { kind: 'runs' as const, runs: await runsState(ctx) }
        : { kind: 'run' as const, run: await viewRun(ctx, await runOf(ctx, options, runId, { anyone: true })) },
    shown => (shown.kind === 'runs' ? runsText(shown.runs) : runText(shown.run))
  );

export interface WatchRunOptions extends RunCommandOptions {
  interval?: number;
  timeout?: number;
}

/** `plitzi run watch`: ends with what is new for the lead — what a lead waiting in the background runs. */
const watchForLead = (runId: string | undefined, options: WatchRunOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const id = await runOf(ctx, options, runId);
      // The run's keeper, should none run: a run opened before it existed, or one whose keeper died, gets it here.
      const kept = await ensureKeeper(ctx, id);
      const news = await waitForLead(ctx, id, {
        timeoutMs: options.timeout ?? FOLLOW_MS,
        everyMs: Math.max(1, options.interval ?? 10) * 1000,
        launch: !('pid' in kept)
      });
      const { view, ...rest } = news;

      return {
        ...rest,
        ...(view ? { status: view.status, done: view.done, total: view.total, board: boardLines(view) } : {})
      };
    },
    news =>
      news.gone
        ? 'The run is gone: it finished, or a person aborted it.'
        : news.timedOut
          ? [
              `Nothing that needs the lead in ${durationText(options.timeout ?? FOLLOW_MS)} (${String(news.done)} of ${String(news.total)} done): watch again.`,
              ...news.fresh.map(item => `  · ${item.text}`)
            ].join('\n')
          : [
              chalk.bold(`For the lead (${String(news.done)} of ${String(news.total)} done):`),
              ...news.fresh.map(item => `  ⚠ ${item.text}`),
              // The board with it: what woke the lead, and where every task stands — no `run status` after each watch.
              ...(news.board && news.board.length > 0 ? [chalk.dim('The board:'), ...news.board] : [])
            ].join('\n')
  );

/**
 * Whether who watches leads the run: its watch ends on what needs it. Every lead's watch was `--until lead` (83 of 83 in
 * two runs); a person follows the run (`run monitor`, or this).
 */
const watchedByLead = async (runId: string | undefined, options: WatchRunOptions): Promise<boolean> => {
  try {
    const ctx = await contextFor(options);
    const id = await runOf(ctx, options, runId, { anyone: true });

    await loadRun(ctx, id);

    return ctx.agent === LEAD;
  } catch (error) {
    // Said by the watch itself, which reads the run the same way.
    if (isRunRefusal(error)) {
      return false;
    }

    throw error;
  }
};

/** `plitzi run watch`: the run as it goes, again whenever it changes — one JSON object a line with --json. */
export const runWatch = async (runId: string | undefined, options: WatchRunOptions): Promise<void> => {
  if (await watchedByLead(runId, options)) {
    return watchForLead(runId, options);
  }

  const every = Math.max(1, options.interval ?? 2) * 1000;
  let last = '';
  let sweptAt = Date.now();
  for (;;) {
    let printed = '';
    try {
      const ctx = await contextFor(options);
      const view = await viewRun(ctx, await runOf(ctx, options, runId));
      printed = options.json ? JSON.stringify(view) : runText(view);
      if (Date.now() - sweptAt > 30 * 60_000) {
        await pruneRuns(ctx);
        sweptAt = Date.now();
      }
    } catch (error) {
      if (!isRunRefusal(error)) {
        throw error;
      }

      // A run that was there and is gone finished or was aborted: following it ends, as it did.
      if (error.code === 'not-found' && last !== '') {
        console.log(
          options.json ? JSON.stringify({ gone: true }) : 'The run is gone: it finished, or a person aborted it.'
        );

        return;
      }

      console.log(options.json ? JSON.stringify(error.toJSON()) : `${error.code}: ${error.message}`);
      process.exitCode = error.exitCode;

      return;
    }

    if (printed !== last) {
      console.log(options.json ? printed : `\n${new Date().toISOString().slice(11, 19)} UTC\n${printed}`);
      last = printed;
    }

    await new Promise(resolve => setTimeout(resolve, every));
  }
};

/** What `run show` is asked: a version to read — or, `--restore`, a backup to put back (`true`: the base). */
export interface ShowOptions extends RunCommandOptions {
  version?: 'run' | 'base' | 'project';
  restore?: string | true;
}

export const runShow = async (runId: string, file: string, options: ShowOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const bytes = await showVersion(ctx, runId, file, options.version ?? 'run');

      return { file, version: options.version ?? 'run', text: bytes?.toString('utf-8') ?? null };
    },
    shown => shown.text ?? `(${shown.file} does not exist in that version)`
  );

/** What `run report --full` prints whole: a harness cuts one answer near 30k characters (Claude Code's). */
export const PRINTED_WHOLE = 24_000;

/**
 * The whole report as one answer — or, past what a harness shows of one, the brief and the file it is written to: a
 * run's lead read a 31k `--full` three times in four minutes, each cut where its harness stops.
 */
export const fullAnswer = (whole: string, brief: string, file: string): { text: string; write: boolean } =>
  whole.length > PRINTED_WHOLE
    ? {
        text: `${brief}\n\nThe whole report (${String(Math.round(whole.length / 1000))}k characters, past what one answer shows) is in ${file} — read it in parts.`,
        write: true
      }
    : { text: whole, write: false };

export const runReport = (
  runId: string | undefined,
  options: RunCommandOptions & { summary?: string; full?: boolean } & ExperienceFlags
): Promise<void> =>
  act(
    options,
    async ctx => {
      // The lead's report is its summary and what it was like, said together — asked before anything is written.
      const experience = options.summary === undefined ? undefined : experienceFrom(options, 'run report --summary');
      // A run applied: its summary written again into the report it kept — what its lead adds reading it after.
      const finished = await finishedRun(ctx, { ...options, ...(runId === undefined ? {} : { run: runId }) });
      if (finished !== undefined && options.summary !== undefined && experience) {
        const file = path.resolve(ctx.root, options.summary);
        const text = (await readOptional(file))?.toString('utf-8');
        if (text === undefined || text.trim() === '') {
          throw new RunRefusal(
            'invalid',
            `--summary names a file, and ${options.summary} is ${text === undefined ? 'no file' : 'empty'}`
          );
        }

        const { dir } = await amendKeptRun(ctx, finished, async kept => {
          await keepSummary(ctx, kept, text, experience);

          return 'wrote the summary again';
        });

        return { amended: dir };
      }

      const id = await runOf(ctx, options, runId, {
        anyone: options.summary === undefined
      });
      if (options.summary && experience) {
        await writeSummary(ctx, id, options.summary, experience);
      }

      const loaded = await loadRun(ctx, id, { anyVersion: true });
      const summary = await readSummary(loaded);
      const report = await buildReport(ctx, loaded);
      if (options.full !== true || options.json === true) {
        return { report, ...(summary === undefined ? {} : { summary }), answer: undefined };
      }

      const file = runPaths(ctx.root, id).fullReport;
      const whole = reportText(report, summary);
      const answer = fullAnswer(whole, reportBrief(report), path.relative(ctx.root, file));
      if (answer.write) {
        await writeFile(file, `${whole}\n`);
      }

      return { report, ...(summary === undefined ? {} : { summary }), answer: answer.text };
    },
    said =>
      'amended' in said
        ? `The run's summary written again into its report — feedback.md, report.md and report.json, each saying so (${said.amended})`
        : `${said.answer ?? reportBrief(said.report)}${said.summary === undefined ? '\nThe lead closes the run with its summary: plitzi run report --summary <file>' : ''}`
  );

export const runPreview = async (
  runId: string | undefined,
  options: RunCommandOptions & { port?: number; task?: string }
): Promise<void> => {
  try {
    const ctx = await contextFor(options);
    // Run by `npm run start:preview` whenever one is wanted: with no run open, said as nothing to preview, and how the
    // project itself is served.
    if (runId === undefined && options.run === undefined && (await activeRuns(ctx.root)).length === 0) {
      throw new RunRefusal(
        'not-found',
        `No run is open in this project: there is nothing of the agents’ to preview. The project as it is: ${projectRun('start:dev')} — start:preview serves an open run’s approved work, as the agents’ tasks are approved`
      );
    }

    const run = await runOf(ctx, options, runId);
    const { task } = options;
    const preview =
      task === undefined
        ? await startPreview(ctx, run, options.port ?? 8300)
        : await startTaskPreview(ctx, run, task, options.port ?? 8301);
    console.log(
      task === undefined
        ? `The run's work as it goes: ${preview.url} — served from ${preview.dir}; each approval shows in it. Ctrl-C stops it; it stops by itself when the run ends.`
        : [
            preview.borrowed === undefined
              ? `${task}'s copy: ${preview.url} — as it went to review, or as its agent writes it. Ctrl-C stops it; it stops by itself once the task is neither worked nor in review.`
              : `${task}'s copy: ${preview.url} — ${preview.borrowed.by === 'agent' ? "its agent's own server" : 'the server a picture of it kept'}, on :${String(preview.borrowed.port)}, serves it already (it holds the copy's state): followed there, never stopped from here.`,
            // `page check` holds a page to the space of the folder it runs in: from the project, a page this task made is
            // not there yet and reads as not found.
            `Check its pages from its copy, which holds them: cd ${preview.dir} && plitzi page check <path> --url ${preview.url}`
          ].join('\n')
    );
    process.once('SIGINT', preview.stop);
    const ended = await preview.done;
    console.log(ended.why);
    process.exitCode = ended.code;
  } catch (error) {
    if (!isRunRefusal(error)) {
      throw error;
    }

    console.error(`${chalk.red(`Refused (${error.code}):`)} ${error.message}`);
    process.exitCode = error.exitCode;
  }
};

/** `plitzi run report --bench`: every run of the project measured the same way, oldest first — whether the team gets better. */
export const runBench = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => ({ runs: await readBench(ctx.root) }),
    ({ runs }) => benchText(runs).join('\n')
  );

/** `plitzi run keep`: the run's keeper — started by the run itself; by hand only to watch it work. */
export const runKeep = async (runId: string | undefined, options: RunCommandOptions): Promise<void> => {
  const ctx = await contextFor(options);
  await keepAgents(ctx, await runOf(ctx, options, runId));
};

/** What `run preview` is asked: the run's work served — a task's copy with `task` — or, `copy`, made a folder. */
export interface PreviewOptions extends RunCommandOptions {
  port?: number;
  task?: string;
  /** `--copy [dir]`: the folder (`true`: the scratch's run-copy). */
  copy?: string | true;
}

/**
 * `plitzi run preview --copy [dir]`: the run's approved work as a folder — a spike's measurements made on it, apart
 * from the project. One command for the run's work outside the run, where `run copy` was another.
 */
export const runCopy = (runId: string | undefined, options: PreviewOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      if (options.task !== undefined || options.port !== undefined) {
        throw new RunRefusal(
          'invalid',
          '--copy makes the approved work a folder, served by nobody: leave out --task and --port (a task’s copy is served by run preview --task)'
        );
      }

      return copyRunWork(ctx, await runOf(ctx, options, runId), options.copy === true ? undefined : options.copy);
    },
    copied =>
      `The run's approved work (${String(copied.files)} file(s) of it) is at ${copied.dir}, made afresh — its state its own, empty. Serve it there on a port of its own: cd ${copied.dir} && PORT=<port> ${projectRun('start')} — or run its specs there.`
  );
