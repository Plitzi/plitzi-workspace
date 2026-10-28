import { execFile } from 'node:child_process';
import path from 'node:path';

import { answering, freePort } from '../../../runs/copies/acceptance';
import { previewDir, startPreview } from '../../../runs/copies/preview';
import { previewPort } from '../../../runs/copies/previewRecord';
import { RunRefusal } from '../../../runs/core/refusal';
import { acceptanceAddresses, examplePaths, pagesOf } from '../../../runs/plan/pagesOf';
import { assertStatus, loadRun, logRun, readApproved } from '../../../runs/run';
import { checkAccount, sessionCookie } from '../../page/check/account';
import { act, runOf } from '../shell';

import type { RunCommandOptions } from '../shell';

/**
 * `plitzi run look`: the run's whole result, once, before it is finished — its approved work served as `run preview`
 * serves it, every page its changes are drawn at checked (`page check`) and pictured at the desktop in light and the
 * phone in dark (`page shot`). The lead reviews no task while testers do: this look is its one review, of what the
 * person will be handed (Carlos) — and `run finish` asks for it after the last approval.
 */

export interface RunLooked {
  runId: string;
  url: string;
  pages: string[];
  /** Pages the run changed that no link of the site and no line of its acceptance reaches: not looked at, said. */
  unreached: string[];
  /** What `page check` said of them, as it says it. */
  check: string;
  /** Whether every page passed its check. */
  passed: boolean;
  /** Where the pictures are. */
  shots: string;
}

/** This CLI, run as a child in `cwd`: what it printed and how it ended. */
const ownCli = (cwd: string, args: string[]): Promise<{ code: number; out: string }> =>
  new Promise(resolve => {
    execFile(
      process.execPath,
      [process.argv[1] ?? 'plitzi', ...args],
      { cwd, maxBuffer: 16 * 1024 * 1024, timeout: 10 * 60_000 },
      (error, stdout, stderr) => {
        resolve({
          code: error === null ? 0 : typeof error.code === 'number' ? error.code : 1,
          out: `${stdout}${stderr}`.trim()
        });
      }
    );
  });

export const runLook = (runId: string | undefined, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async (ctx): Promise<RunLooked> => {
      const run = await runOf(ctx, options, runId);
      const loaded = await loadRun(ctx, run);
      assertStatus(loaded, ['open', 'stopping'], 'look at the run');
      const approved = Object.keys((await readApproved(loaded.paths)).files);
      if (approved.length === 0) {
        throw new RunRefusal('invalid', `Run "${run}" has approved nothing yet: there is no result to look at`);
      }

      // A preview open already — the monitor's — serves the same folder: looked at there, never a second one.
      const running = await previewPort(loaded);
      const served =
        running === undefined ? await startPreview(ctx, run, await freePort(), { quiet: true }) : undefined;
      const url = served?.url ?? `http://127.0.0.1:${String(running)}`;
      const dir = previewDir(loaded.paths);
      try {
        if (!(await answering(url, 60_000))) {
          throw new RunRefusal('invalid', `The run's work did not answer on ${url} within a minute`);
        }

        // Every page the run changed — none cut at a task's few — each route made an address the site reaches, as the
        // project's account sees it: a run's look missed four and checked two patterns as written (a 404).
        const changed = await pagesOf(dir, approved, Number.POSITIVE_INFINITY);
        const named = [...new Set(loaded.tasks.flatMap(task => acceptanceAddresses(task.acceptance)))];
        const account = await checkAccount(dir);
        const cookie = account === undefined || 'problem' in account ? undefined : await sessionCookie(url, account);
        const { paths: reached, unreached } = await examplePaths(
          url,
          changed.length > 0 ? changed : ['/'],
          named,
          typeof cookie === 'string' ? cookie : undefined
        );
        const looked = reached.length > 0 ? reached : ['/'];
        const shots = path.join(loaded.paths.shots, 'run-look');
        // From the folder served, which holds the run's pages: from the project, a page the run made is not there yet.
        const check = await ownCli(dir, ['page', 'check', ...looked, '--url', url, '--width', '1440,390']);
        await ownCli(dir, [
          'page',
          'shot',
          ...looked,
          '--url',
          url,
          '--width',
          '1440,390',
          '--scheme',
          'light,dark',
          '--out',
          `${shots}/`
        ]);
        await logRun(ctx, loaded.paths, { action: 'run-look', pages: looked, passed: check.code === 0 });

        return { runId: run, url, pages: looked, unreached, check: check.out, passed: check.code === 0, shots };
      } finally {
        served?.stop();
      }
    },
    looked =>
      [
        `The run's whole result, as the person will be handed it (${looked.url}): ${looked.pages.join(', ')}`,
        ...(looked.unreached.length > 0
          ? [
              `Not looked at — no link of the site nor line of the run reaches them: ${looked.unreached.join(', ')} (look at one yourself: plitzi page check <address> --url ${looked.url})`
            ]
          : []),
        looked.check,
        `Pictures — 1440 and 390, light and dark: ${looked.shots}/`,
        looked.passed
          ? 'Then: plitzi run report --summary "…" and plitzi run finish'
          : 'What failed is the run’s: send it to a task (plitzi run open <stage.json>), or say why it stands, then finish'
      ].join('\n')
  );
