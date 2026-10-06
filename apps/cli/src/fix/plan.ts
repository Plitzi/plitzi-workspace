import { planFixes, refusalOf } from '@plitzi/sdk-authoring';

import type { ProjectSpace } from '../commands/projectSpace';
import type { FixPlan, PlanProblem, PlannedFix } from '@plitzi/sdk-authoring';

/** The plan for the project's space as it is on disk — or why there is none: it did not get as far as its documents. */
export type ProjectPlan = FixPlan | { problem: string };

/** A fix by what it is, to tell whether it is still to be made after the source was edited. */
export const fixKey = (fix: Pick<PlannedFix, 'code' | 'elementId' | 'message'>): string =>
  `${fix.code} ${fix.elementId ?? ''} ${fix.message}`;

/** A problem by its code and its element: the message may change with a fix, the problem is the same problem. */
export const problemKey = (problem: Pick<PlanProblem, 'code' | 'elementId'>): string =>
  `${problem.code} ${problem.elementId ?? ''}`;

export const projectPlan = ({ space, authoring }: ProjectSpace): ProjectPlan => {
  try {
    return planFixes(space, authoring);
  } catch (error) {
    return { problem: `the space is not written as far as its documents — ${refusalOf(error).message.split('\n')[0]}` };
  }
};

/**
 * Why the fixes written are not to be kept, by element: a fix still there to make, a problem that was not there
 * before. An element named is one whose fixes go back to the author; a reason with no element blames them all.
 */
export const verdict = (
  before: FixPlan,
  written: readonly PlannedFix[],
  after: ProjectPlan
): { reasons: string[]; elements: Set<string | null> } => {
  if ('problem' in after) {
    return { reasons: [`the space no longer authors: ${after.problem}`], elements: new Set([null]) };
  }

  const still = new Set(after.fixes.map(fixKey));
  const known = new Set(before.problems.map(problemKey));
  const stuck = written.filter(fix => still.has(fixKey(fix)));
  const added = after.problems.filter(problem => !known.has(problemKey(problem)));

  return {
    reasons: [
      ...stuck.map(fix => `still to fix: [${fix.code}] ${fix.message}`),
      ...added.map(problem => `new problem: [${problem.code}] ${problem.message}`)
    ],
    elements: new Set([...stuck.map(fix => fix.elementId), ...added.map(problem => problem.elementId)])
  };
};
