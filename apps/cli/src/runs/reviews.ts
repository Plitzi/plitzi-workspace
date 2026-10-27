import { LEAD } from './messages';
import { RunRefusal } from './refusal';
import { isResearch } from './spike';
import { updateState, viewTask } from './taskStore';
import { DEVELOPER, readTeam, startedAgents, TESTER } from './team';
import { byUrgency } from './urgency';
import { workedBy } from './worked';

import type { RunTask, TaskState } from './model';
import type { LoadedRun, RunContext } from './run/context';
import type { TaskView } from './taskStore';
import type { StartedAgent, Team } from './team';

/**
 * A card's review, one kind for every card — the run is a kanban (Carlos): its reviews are the roles its card names, in
 * order (`review: ["designer", "tester"]`), each a step said by an agent of that role. The rules are the same at every
 * step: nobody says a step of what it worked; a step taken is its reviewer's for a while, then another's; the one who
 * said it the round before is offered it first; a step nobody takes in time is the next step's reviewer's too; the
 * lead has the last word on any. Where there was a designer's UI review and a tester's QA, each with its own rules,
 * there is one review of steps.
 */

/** The role a card is reviewed by when it names none: a tester — the lead, in a team without one. */
export const DEFAULT_REVIEW_ROLE = TESTER;

/** A card's review where it stands: its round, the step it waits for, who took that step. */
export interface ReviewState {
  round: number;
  /** The step of the card's review (`reviewSteps`) that waits to be said. */
  step: number;
  /** Who took this step, and when: the step is theirs to say for `stepTimeOf` it. */
  by?: string;
  at?: string;
  /** When this step came due: what a wait for it is counted from. */
  since: string;
  /** Who said each step the round before, by step: offered that step first (it knows what it asked). */
  before?: string[];
  /** Taken as its reviewer's first review of the run: its time holds the reading it asks for first. */
  first?: true;
}

/** Who of the team reviews, by role — the agents the team starts, and its developers among them. */
export interface ReviewTeam {
  byRole: Partial<Record<string, string[]>>;
  developers: string[];
}

/** Who of a team reviews, by role: what its `team.json` starts. */
export const reviewTeamFrom = (team: Team | undefined): ReviewTeam =>
  reviewTeamOfAgents(team ? startedAgents(team) : []);

/** Who of these agents reviews, by role. */
export const reviewTeamOfAgents = (started: readonly StartedAgent[]): ReviewTeam => {
  const byRole: Partial<Record<string, string[]>> = {};
  for (const member of started) {
    for (const role of member.roles) {
      byRole[role] = [...(byRole[role] ?? []), member.agent];
    }
  }

  return {
    byRole,
    developers: started.flatMap(each =>
      each.roles.includes(DEVELOPER) && !each.roles.includes(TESTER) ? [each.agent] : []
    )
  };
};

export const reviewTeamOf = async (root: string): Promise<ReviewTeam> =>
  reviewTeamFrom(await readTeam(root).catch(() => undefined));

/** The roles `agent` reviews as in the team — a designer, a tester: every role of its but a developer's own. */
export const reviewRolesOf = (team: ReviewTeam, agent: string): string[] =>
  Object.entries(team.byRole).flatMap(([role, agents]) =>
    role !== DEVELOPER && agents?.includes(agent) === true ? [role] : []
  );

/**
 * The roles a card is reviewed by, in order: its own (`review`) — a role nobody in the team takes stands as the default
 * reviewer, so a card that asks for a tester in a team with none is still reviewed for QA, by the lead — else the
 * default alone: a tester, or the lead in a team without one. A research card's, the lead's.
 */
export const reviewSteps = (task: RunTask, team: ReviewTeam): string[] => {
  if (isResearch(task)) {
    return [LEAD];
  }

  const fallback = (team.byRole[DEFAULT_REVIEW_ROLE]?.length ?? 0) > 0 ? DEFAULT_REVIEW_ROLE : LEAD;
  const steps = (task.review ?? []).map(role =>
    role === LEAD || (team.byRole[role]?.length ?? 0) > 0 ? role : fallback
  );
  const once = steps.filter((role, index) => steps.indexOf(role) === index);

  return once.length > 0 ? once : [fallback];
};

/** The roles a card names that nobody in the team takes: their step is the default reviewer's, and said. */
export const stepsLeftOut = (task: RunTask, team: ReviewTeam): string[] =>
  (task.review ?? []).filter(role => role !== LEAD && (team.byRole[role]?.length ?? 0) === 0);

/** Why a card's step is the lead's to say: its card names the lead, it is research, or nobody of its roles is in the team. */
export const leadStepWhy = (task: RunTask, team: ReviewTeam): string => {
  if (isResearch(task)) {
    return 'research is the lead’s to decide';
  }

  if (task.review?.includes(LEAD) === true) {
    return 'its card names the lead';
  }

  return `the team has no ${(stepsLeftOut(task, team).length > 0 ? stepsLeftOut(task, team) : [DEFAULT_REVIEW_ROLE]).join(' or ')}`;
};

/**
 * Who may say a step of a card's review: the agents of its role that worked neither the card nor, for a card of tests,
 * what it tests; with none, a developer that worked neither; with none, the lead — who says any step, always.
 */
export const stepReviewers = (view: TaskView, views: readonly TaskView[], role: string, team: ReviewTeam): string[] => {
  if (role === LEAD) {
    return [LEAD];
  }

  const tested = views.filter(each => view.task.testsOf?.includes(each.task.id) === true);
  const clean = (agent: string): boolean => !workedBy(view, agent) && !tested.some(each => workedBy(each, agent));
  const ofRole = (team.byRole[role] ?? []).filter(clean);
  if (ofRole.length > 0) {
    return ofRole;
  }

  const spare = team.developers.filter(clean);

  return spare.length > 0 ? spare : [LEAD];
};

/** The step a card waits for now, as a role — none while it is not in review. */
export const stepRole = (view: TaskView, team: ReviewTeam): string | undefined => {
  const { review } = view.state;
  if (view.state.status !== 'in-review' || review === undefined) {
    return undefined;
  }

  return reviewSteps(view.task, team).at(review.step);
};

/**
 * How long a step taken is its reviewer's: past it, another of its role takes it, or the lead decides it — the reviewer
 * told. A run's design-1 held one 16 min, and a task waited 18 min queued behind it.
 */
export const REVIEW_TIMEOUT_MS = 8 * 60_000;

/** More time for an agent's first review of the run: it reads what it is told to first. */
export const FIRST_REVIEW_READING_MS = 7 * 60_000;

/** How long a step nobody took waits before the next step's reviewer may take it too: a review waits for nobody. */
export const REVIEW_QUEUE_MS = 5 * 60_000;

export const stepTimeOf = (review: Pick<ReviewState, 'first'> | undefined): number =>
  REVIEW_TIMEOUT_MS + (review?.first === true ? FIRST_REVIEW_READING_MS : 0);

/** The minutes a taken step is past its time, if it is: none while it is in time, or untaken. */
export const stepTimedOut = (review: ReviewState | undefined, now: number): number | undefined => {
  if (review?.by === undefined || review.at === undefined) {
    return undefined;
  }

  const held = now - Date.parse(review.at);

  return held > stepTimeOf(review) ? Math.round(held / 60_000) : undefined;
};

/** A step nobody took past `REVIEW_QUEUE_MS`: the next step's reviewer may say it too. */
export const stepQueued = (review: ReviewState | undefined, now: number): boolean =>
  review !== undefined && review.by === undefined && now - Date.parse(review.since) >= REVIEW_QUEUE_MS;

/** Whether `agent` may say the step a card waits for now: a reviewer of it — or of the next, once it queued. */
export const maySayStep = (
  view: TaskView,
  views: readonly TaskView[],
  agent: string,
  team: ReviewTeam,
  now: number
): boolean => {
  const { review } = view.state;
  const role = stepRole(view, team);
  if (role === undefined || review === undefined || view.owner?.agent === agent) {
    return false;
  }

  // Who took it may say it: the next step's reviewer that took a step queued past its time too.
  if (agent === LEAD || review.by === agent || stepReviewers(view, views, role, team).includes(agent)) {
    return true;
  }

  const next = reviewSteps(view.task, team).at(review.step + 1) ?? LEAD;

  return stepQueued(review, now) && next !== LEAD && stepReviewers(view, views, next, team).includes(agent);
};

/** Whether the step is free for `agent` to take: nobody took it, `agent` did, or its taker is past its time. */
export const stepFreeFor = (review: ReviewState | undefined, agent: string, now: number): boolean =>
  review !== undefined && (review.by === undefined || review.by === agent || stepTimedOut(review, now) !== undefined);

/**
 * The review `task next` offers an agent: a card whose step it may say and may take — the one it said the round before
 * first, then the most urgent (`byUrgency`), then the one that waited longest. The lead is offered only what is its own:
 * a step of the lead's, or one nobody else may say.
 */
export const reviewFor = (
  views: readonly TaskView[],
  agent: string,
  team: ReviewTeam,
  now: number
): TaskView | undefined => {
  const urgency = byUrgency(views.map(view => view.task));
  const said = (view: TaskView): boolean => {
    const { review } = view.state;

    return review?.before?.[review.step] === agent;
  };

  return views
    .filter(view => {
      const role = stepRole(view, team);
      if (role === undefined || !stepFreeFor(view.state.review, agent, now)) {
        return false;
      }

      return agent === LEAD
        ? stepReviewers(view, views, role, team).includes(LEAD)
        : maySayStep(view, views, agent, team, now);
    })
    .sort(
      (a, b) =>
        Number(said(b)) - Number(said(a)) ||
        urgency(a.task, b.task) ||
        (a.state.review?.since ?? a.state.updatedAt).localeCompare(b.state.review?.since ?? b.state.updatedAt)
    )
    .at(0);
};

/** Who said each step, with `by` said at `step`. */
const saidAt = (before: readonly string[] | undefined, step: number, by: string | undefined): string[] => {
  const said = [...(before ?? [])];
  if (by !== undefined) {
    said[step] = by;
  }

  return said;
};

/** A card's review as it goes to review: its first step due, who said each step before kept to offer it again. */
export const reviewAtComplete = (state: TaskState, now: string): ReviewState => {
  const said = state.review ? saidAt(state.review.before, state.review.step, state.review.by) : [];

  return { round: state.round, step: 0, since: now, ...(said.length > 0 ? { before: said } : {}) };
};

/** The review after a step is approved: the next step due — or none left, the card approved. */
export const nextStep = (
  review: ReviewState,
  steps: readonly string[],
  now: string
): { review: ReviewState } | { approved: true } => {
  const said = saidAt(review.before, review.step, review.by);
  if (review.step + 1 >= steps.length) {
    return { approved: true };
  }

  return { review: { round: review.round, step: review.step + 1, since: now, before: said } };
};

/** A step let go as its card leaves review — sent back, escalated, cut: who held it is kept as the one before. */
export const letGoStep = (review: ReviewState): ReviewState => {
  if (review.by === undefined) {
    return review;
  }

  return {
    round: review.round,
    step: review.step,
    since: review.since,
    before: saidAt(review.before, review.step, review.by)
  };
};

const viewsOf = (loaded: LoadedRun): Promise<TaskView[]> =>
  Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));

/** Whether `agent` is the lead or a person: the last word on any step. */
const principal = (agent: string): boolean => agent === LEAD || agent === 'person';

/**
 * A verdict on the step a card waits for — its reviewer's, or the lead's on any: another of the step's reviewers is
 * refused while one holds it in time, and anyone else is refused, naming who says it.
 */
export const assertStepReviewer = async (ctx: RunContext, loaded: LoadedRun, view: TaskView): Promise<void> => {
  if (principal(ctx.agent)) {
    return;
  }

  const team = await reviewTeamOf(ctx.root);
  const views = await viewsOf(loaded);
  const role = stepRole(view, team) ?? DEFAULT_REVIEW_ROLE;
  const now = ctx.now().getTime();
  if (!maySayStep(view, views, ctx.agent, team, now)) {
    throw new RunRefusal(
      workedBy(view, ctx.agent) ? 'invalid' : 'lead-only',
      workedBy(view, ctx.agent)
        ? `${ctx.agent} worked ${view.task.id}: its ${role}'s review is another's — leave it, and go on with plitzi task next`
        : `${view.task.id} waits for its ${role}'s review: ${stepReviewers(view, views, role, team).join(', ')} says it, or the lead`,
      { task: view.task.id, holder: LEAD }
    );
  }

  const { review } = view.state;
  if (review?.by !== undefined && review.by !== ctx.agent && stepTimedOut(review, now) === undefined) {
    throw new RunRefusal(
      'claimed',
      `${review.by} reviews ${view.task.id} (its ${role}'s review): it is theirs to say for ${String(stepTimeOf(review) / 60_000)} min from taking it, then another's — what you found, tell the lead: plitzi task tell --about ${view.task.id} "…"`,
      { task: view.task.id, holder: review.by }
    );
  }
};

/**
 * A step taken as `ctx.agent`'s own — free, its own, or its taker past its time — said back with who held it before
 * when that one is taken from: it is told. False when another took it first.
 */
export const takeStep = async (
  ctx: RunContext,
  view: TaskView,
  /** Its reviewer's first review of the run: its time holds the reading asked first. */
  first = false
): Promise<{ taken: boolean; from?: string; minutes?: number }> => {
  const now = ctx.now().getTime();
  const was = view.state.review;
  const late = stepTimedOut(was, now);
  const after = await updateState(
    view.paths,
    state =>
      state.status === 'in-review' && state.review && stepFreeFor(state.review, ctx.agent, now)
        ? {
            ...state,
            review: {
              ...state.review,
              by: ctx.agent,
              at: ctx.now().toISOString(),
              ...(first ? { first: true as const } : {})
            }
          }
        : state,
    ctx.now
  );
  const taken = after.review?.by === ctx.agent;

  return taken && was?.by !== undefined && was.by !== ctx.agent && late !== undefined
    ? { taken, from: was.by, minutes: late }
    : { taken };
};

/**
 * A look at a card whose step `ctx.agent` may say takes that step — said in the activity as `task next` says it: a run's
 * lead looked and approved, and the person following the run saw nobody take its reviews.
 */
export const takeOnLook = async (ctx: RunContext, loaded: LoadedRun, view: TaskView): Promise<boolean> => {
  if (view.state.status !== 'in-review' || view.state.review?.by === ctx.agent) {
    return false;
  }

  const team = await reviewTeamOf(ctx.root);
  const role = stepRole(view, team);
  const mine =
    role !== undefined &&
    (ctx.agent === LEAD
      ? stepReviewers(view, await viewsOf(loaded), role, team).includes(LEAD)
      : maySayStep(view, await viewsOf(loaded), ctx.agent, team, ctx.now().getTime()));

  return mine ? (await takeStep(ctx, view)).taken : false;
};
