import { loadRun } from '../runs/run';
import { completeResearch, findTask, reportProgress, reviewTask } from '../runs/tasks';
import { viewTask } from '../runs/taskStore';

import type { Bench } from './runProject';
import type { RunContext } from '../runs/run';
import type { Researched, ReviewedTask } from '../runs/tasks';

/**
 * A research card's steps, as its scout and the lead take them: what it found, said by whoever holds it — its token, as
 * its copy carries it — how far it got, and the lead's verdict on it.
 */
export const researchSteps = (bench: () => Bench) => {
  const lead = (): RunContext => bench().agent('lead');

  const holding = async (runId: string, card: string): Promise<RunContext> => {
    const loaded = await loadRun(lead(), runId);
    const { owner } = await viewTask(loaded.paths, findTask(loaded, card));
    if (owner === undefined) {
      throw new Error(`${card} is held by nobody: take it first`);
    }

    return bench().agent(owner.agent, { token: owner.token });
  };

  return {
    progress: async (runId: string, card: string, progress: { fraction?: number; step?: string }): Promise<void> => {
      await reportProgress(await holding(runId, card), runId, card, progress);
    },
    found: async (runId: string, card: string, text: string, options: { tasks?: string } = {}): Promise<Researched> =>
      completeResearch(await holding(runId, card), runId, card, text, options),
    approveFound: (runId: string, card: string, leave?: readonly string[] | 'all'): Promise<ReviewedTask> =>
      reviewTask(lead(), runId, card, 'approve', [], 'refuse', leave === undefined ? {} : { leave }),
    sendBack: (runId: string, card: string, note: string): Promise<ReviewedTask> =>
      reviewTask(lead(), runId, card, 'changes', [{ note }])
  };
};
