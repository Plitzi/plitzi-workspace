import chalk from 'chalk';

import { act, contextFor, runOf } from './shell';
import { durationText, FOLLOW_MS } from '../../options';
import { benchText, readBench } from '../../runs/bench';
import { experienceFrom } from '../../runs/experience';
import { ensureKeeper, keepAgents } from '../../runs/keeper';
import { waitForLead } from '../../runs/leadWatch';
import { showVersion } from '../../runs/merge';
import { startPreview, startTaskPreview } from '../../runs/preview';
import { isRunRefusal, RunRefusal } from '../../runs/refusal';
import { buildReport, readSummary, reportText, writeSummary, writeTokens } from '../../runs/report';
import { activeRuns, loadRun, pruneRuns } from '../../runs/run';
import { pendingRuns, runsState, runText, viewRun } from '../../runs/view';

import type { RunCommandOptions } from './shell';
import type { ExperienceFlags } from '../../runs/experience';

/**
 * A run as it goes: its state and status, watched — for the lead, until something needs it — what awaits applying,
 * one run's record, its report and its preview.
 */

export const runPending = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    ctx => pendingRuns(ctx),
    pending =>
      pending.length === 0
        ? 'Nothing pending: no run of this project is waiting to be written into it.'
        : [
            ...pending.map(run =>
              run.ready
                ? `${chalk.green('ready')} ${run.runId} — ${run.goal} (${String(run.done)} of ${String(run.total)} done)\n  ${run.leadFinishes ? 'the lead may apply it, as you allowed — or you: ' : 'apply it, in your terminal: '}${run.apply}`
                : `${chalk.yellow(run.status)} ${run.runId} — ${run.goal} (${String(run.done)} of ${String(run.total)} done): still at work`
            )
          ].join('\n')
  );

export const runState = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    ctx => runsState(ctx),
    runs =>
      runs.length === 0
        ? 'No runs in this project.'
        : runs
            .map(
              run =>
                `${run.runId}: ${run.status}, ${String(run.done)} of ${String(run.total)} tasks done${run.activeOn ? ` on ${run.activeOn}` : ', released'}${run.attention > 0 ? `, ${String(run.attention)} needing attention` : ''} — each task, its agent and the files it holds: plitzi run status ${run.runId} (or plitzi task claims)`
            )
            .join('\n')
  );

export const runStatus = (runId: string | undefined, options: RunCommandOptions): Promise<void> =>
  act(options, async ctx => viewRun(ctx, await runOf(ctx, options, runId, { anyone: true })), runText);

export interface WatchRunOptions extends RunCommandOptions {
  interval?: number;
  until?: 'lead';
  timeout?: number;
}

/** `plitzi run watch --until lead`: ends with what is new for the lead — what a lead waiting in the background runs. */
const watchForLead = (runId: string | undefined, options: WatchRunOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const id = await runOf(ctx, options, runId);
      // The run's keeper, should none run: a run opened before it existed, or one whose keeper died, gets it here.
      await ensureKeeper(ctx, id);
      const news = await waitForLead(ctx, id, {
        timeoutMs: options.timeout ?? FOLLOW_MS,
        everyMs: Math.max(1, options.interval ?? 10) * 1000
      });
      const { view, ...rest } = news;

      return { ...rest, ...(view ? { status: view.status, done: view.done, total: view.total } : {}) };
    },
    news =>
      news.gone
        ? 'The run is gone: it finished, or a person aborted it.'
        : news.timedOut
          ? `Nothing new for the lead in ${durationText(options.timeout ?? FOLLOW_MS)} (${String(news.done)} of ${String(news.total)} done): watch again.`
          : [
              chalk.bold(`For the lead (${String(news.done)} of ${String(news.total)} done):`),
              ...news.fresh.map(item => `  ⚠ ${item.text}`)
            ].join('\n')
  );

/** `plitzi run watch`: the run as it goes, again whenever it changes — one JSON object a line with --json. */
export const runWatch = async (runId: string | undefined, options: WatchRunOptions): Promise<void> => {
  if (options.until === 'lead') {
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

export const runShow = async (
  runId: string,
  file: string,
  options: RunCommandOptions & { version?: 'run' | 'base' | 'project' }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const bytes = await showVersion(ctx, runId, file, options.version ?? 'run');

      return { file, version: options.version ?? 'run', text: bytes?.toString('utf-8') ?? null };
    },
    shown => shown.text ?? `(${shown.file} does not exist in that version)`
  );

export const runReport = (
  runId: string | undefined,
  options: RunCommandOptions & { summary?: string; tokens?: string } & ExperienceFlags
): Promise<void> =>
  act(
    options,
    async ctx => {
      // The lead's report is its summary and what it was like, said together — asked before anything is written.
      const experience = options.summary === undefined ? undefined : experienceFrom(options, 'run report --summary');
      const id = await runOf(ctx, options, runId, {
        anyone: options.summary === undefined && options.tokens === undefined
      });
      if (options.summary && experience) {
        await writeSummary(ctx, id, options.summary, experience);
      }

      if (options.tokens) {
        await writeTokens(ctx, id, options.tokens);
      }

      const loaded = await loadRun(ctx, id, { anyVersion: true });
      const summary = await readSummary(loaded);

      return { report: await buildReport(ctx, loaded), ...(summary === undefined ? {} : { summary }) };
    },
    ({ report, summary }) =>
      `${reportText(report, summary)}${summary === undefined ? '\nThe lead closes the run with its summary: plitzi run report --summary <file>' : ''}`
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
        'No run is open in this project: there is nothing of the agents’ to preview. The project as it is: npm run start:dev — start:preview serves an open run’s approved work, as the agents’ tasks are approved'
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

/** `plitzi run bench`: every run of the project measured the same way, oldest first — whether the team gets better. */
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
