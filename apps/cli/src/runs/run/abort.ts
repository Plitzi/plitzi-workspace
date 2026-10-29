import { removeRun } from './claim';
import { requirePerson } from './context';
import { loadRun, readApproved } from './record';
import { stopKeptBrowser } from '../../browser/keptBrowser';
import { keepLeadCli } from '../agents/identity';
import { keepNotices } from '../plan/backlog';
import { leaveReport } from '../report/leaveReport';

import type { RemovedInputs } from './claim';
import type { RunContext } from './context';
import type { LeftReport } from '../report/leaveReport';

/**
 * `plitzi run abort`: a run ended writing nothing into the project — a person's change is never undone by aborting —
 * and removed with its backups and its agents' work, said file by file; a person's. Any run: held on another machine,
 * or opened by another CLI, too. Its report is left where it can be read; one that cannot is said, and the run removed
 * all the same — a run nobody can end is a folder nobody can clear.
 */
export const abortRun = async (
  ctx: RunContext,
  runId: string
): Promise<{
  discarded: string[];
  report: LeftReport | { problem: string };
  inputs: RemovedInputs;
  /** The lead's own CLI kept past the run, to amend the report it left (`keepLeadCli`). */
  leadCli?: { cli: string; run: string };
}> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  await requirePerson(ctx, runId, `abort run "${runId}" — nothing of it is written, and its agents' work is discarded`);
  const discarded = Object.keys((await readApproved(loaded.paths)).files).sort();
  const report = await leaveReport(ctx, loaded, { outcome: 'aborted', files: discarded }).catch((error: unknown) => ({
    problem: error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)
  }));
  // Aborted, what it noticed still stands: the next run's — what it says of Plitzi is in its reports.
  await keepNotices(ctx, loaded);
  await stopKeptBrowser(ctx.root);
  // A report left is amended by its lead after this: its own CLI stays, its token going with the run's folder otherwise.
  const leadCli = 'problem' in report ? undefined : await keepLeadCli(loaded.paths, runId);
  const inputs = await removeRun(ctx, loaded.paths, runId);

  return { discarded, report, inputs, ...(leadCli ? { leadCli: { cli: leadCli, run: runId } } : {}) };
};
