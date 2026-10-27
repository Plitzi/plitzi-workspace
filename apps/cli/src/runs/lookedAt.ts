import { testersReview } from './leads';
import { RunRefusal } from './refusal';
import { isApproval, readRunLog } from './run';

import type { LoadedRun, RunContext } from './run';

/**
 * Whether the run's whole result is still to be looked at by the lead: its team has testers — the lead reviewed no task
 * — and no `run look` came after its last approval. With no tester, the lead looked at each task it approved.
 */
export const notLookedAtYet = async (ctx: RunContext, loaded: LoadedRun): Promise<boolean> => {
  if (!(await testersReview(ctx.root))) {
    return false;
  }

  const log = await readRunLog(loaded.paths);
  const lastApproval = log.findLastIndex(isApproval);
  const lastLook = log.findLastIndex(entry => entry.action === 'run-look');

  return lastApproval >= 0 && lastLook < lastApproval;
};

/** What `run finish --apply` says of a run not looked at whole since its last approval. */
export const notLookedRefusal = (runId: string): RunRefusal =>
  new RunRefusal(
    'invalid',
    `Run "${runId}" was not looked at whole since its last approval: the lead looks at the result once before it is written — plitzi run look ${runId}`,
    { run: runId }
  );
