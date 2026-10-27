import fs from 'node:fs/promises';
import path from 'node:path';

import { readJson } from '../core/files';
import { isProposal, isProposalAnswer } from '../core/model';
import { taskPaths } from '../core/paths';

import type { Proposal, ProposalAnswer } from '../core/model';
import type { LoadedRun } from '../run';

/**
 * The proposals between a run's tasks as they stand — read only: what `task complete`, `task context` and the run's view
 * need of them. Making and answering one is `proposals.ts`'s.
 */

export interface ProposalView extends Proposal {
  answer?: ProposalAnswer;
}

/** Every proposal of the run, with its answer if it has one. */
export const proposalsOf = async (loaded: LoadedRun): Promise<ProposalView[]> => {
  const all: ProposalView[] = [];
  for (const task of loaded.tasks) {
    const dir = taskPaths(loaded.paths, task.id).proposals;
    for (const name of (await fs.readdir(dir).catch(() => [])).filter(each => each.endsWith('.json')).sort()) {
      const proposal = await readJson(path.join(dir, name), isProposal, 'a proposal between tasks');
      if (!proposal) {
        continue;
      }

      const answer = await readJson(
        path.join(taskPaths(loaded.paths, proposal.to).answers, `${proposal.id}.json`),
        isProposalAnswer,
        'an answer to a proposal'
      );
      all.push({ ...proposal, ...(answer ? { answer } : {}) });
    }
  }

  return all.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
};

/** The proposals to `taskId` no one has answered: a task does not go to review leaving another waiting on it. */
export const unansweredTo = (all: readonly ProposalView[], taskId: string): ProposalView[] =>
  all.filter(each => each.to === taskId && each.answer === undefined);

/** What `taskId` agreed to, or got agreed: the accepted proposals it is part of — what its review checks too. */
export const agreementsOf = (all: readonly ProposalView[], taskId: string): ProposalView[] =>
  all.filter(each => (each.to === taskId || each.from === taskId) && each.answer?.verdict === 'accept');
