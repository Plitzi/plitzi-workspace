import { readTeam, SCOUT, startedAgents, TESTER } from './team';
import { RunRefusal } from '../core/refusal';
import { LEAD } from '../talk/messages';

import type { RunContext } from '../run/context';

/**
 * A run's one lead — the manager: it plans with the person, approves what a spike proposes, answers, decides what is
 * escalated to it and finishes. Who reviews a card is its review's (`reviews.ts`): the lead says a step only where it
 * is the lead's — named by the card, nobody else may, escalated, or past the review rounds' limit. It is the person's harness, never started again: every review it read stayed in its context — a run's
 * lead read 130 turns of ~110k each, 68% of what the run spent (Carlos).
 */

/** The `--role` the lead asks for its own with: `task next --role lead` — what is escalated to it, and what waits for it. */
export const LEAD_ROLE = 'lead';

/** The team's testers: they review every task in review — its QA. */
export const testersOf = async (root: string): Promise<string[]> => {
  const team = await readTeam(root).catch(() => undefined);

  return team ? startedAgents(team).flatMap(each => (each.roles.includes(TESTER) ? [each.agent] : [])) : [];
};

/** The team's scouts: they take the research cards, and propose the tasks each makes to the lead. */
export const scoutsOf = async (root: string): Promise<string[]> => {
  const team = await readTeam(root).catch(() => undefined);

  return team ? startedAgents(team).flatMap(each => (each.roles.includes(SCOUT) ? [each.agent] : [])) : [];
};

/** Whether the team reviews without the lead: it has a tester. With none, the lead reviews every task. */
export const testersReview = async (root: string): Promise<boolean> => (await testersOf(root)).length > 0;

/** The one who decides: `lead`, or a person at a terminal. */
export const isPrincipal = (agent: string): boolean => agent === LEAD || agent === 'person';

/** The agents the team starts, by name: none of them is a lead. */
const teamAgents = async (root: string): Promise<string[]> => {
  const team = await readTeam(root).catch(() => undefined);

  return team ? startedAgents(team).map(each => each.agent) : [];
};

/**
 * `lead`'s, or a person's: refused to an agent of the team and to any other — planning, answering, reassigning and
 * finishing are the lead's.
 */
export const requireLead = async (ctx: RunContext, action: string): Promise<void> => {
  if (isPrincipal(ctx.agent)) {
    return;
  }

  // Who calls is proved (`identity.ts`): any other is refused, named — a name of no team is no way in either.
  throw new RunRefusal(
    'lead-only',
    (await teamAgents(ctx.root)).includes(ctx.agent)
      ? `${ctx.agent} is an agent of the team; to ${action} is the lead's`
      : `${ctx.agent} is not the lead; to ${action} is the lead's`,
    { holder: LEAD }
  );
};

/**
 * The lead's — `lead`, a person — and no other's: what goes out in the lead's voice (`task message` is from the lead),
 * so a designer or an agent of the team never speaks as it.
 */
export const requireALead = (ctx: RunContext, action: string): void => {
  if (isPrincipal(ctx.agent)) {
    return;
  }

  throw new RunRefusal(
    'lead-only',
    `${ctx.agent} cannot ${action}: it goes out in the lead's voice — tell the lead (plitzi task tell --about <task> "…"), and it says it`,
    { holder: LEAD }
  );
};
