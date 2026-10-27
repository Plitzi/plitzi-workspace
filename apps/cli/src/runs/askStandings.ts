import { messageTasks } from './talk';

import type { RunContext } from './run';
import type { RunView } from './view';

/**
 * Every card past its limit whose agent was not asked yet, asked where it stands in the lead's voice — by the lead's
 * watch and the run's keeper, both the lead's: the lead is woken with the answer to decide on (`longTask.ts`).
 */
export const askStandings = async (ctx: RunContext, runId: string, view: RunView): Promise<string[]> => {
  const agents = [
    ...new Set(view.attention.flatMap(item => (item.kind === 'long-task' && item.asks ? [item.asks] : [])))
  ];
  for (const agent of agents) {
    await messageTasks(ctx, runId, `@${agent}`, '', undefined, true);
  }

  return agents;
};
