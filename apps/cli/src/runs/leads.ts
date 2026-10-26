import { LEAD } from './messages';
import { RunRefusal } from './refusal';
import { uiQueued } from './reviewQueue';
import { updateState, viewTask } from './taskStore';
import { DESIGNER, DEVELOPER, readTeam, SCOUT, startedAgents, TESTER } from './team';
import { byUrgency } from './urgency';
import { isWorked, workedBy } from './worked';

import type { RunTask } from './model';
import type { LoadedRun, RunContext } from './run/context';
import type { TaskView } from './taskStore';

/**
 * A run's one lead — the manager: it plans with the person, approves what a spike proposes, answers, decides what is
 * escalated to it and finishes. The testers review every task (`testerReviews`), their approval the task's; the lead
 * reviews only what a tester escalates or past the review rounds' limit (blocked on it), what nobody else may take —
 * no tester nor developer that did not work it (`leadReviews`) — and every task when the team has no tester. It is the person's harness, never started again: every review it read stayed in its context — a run's
 * lead read 130 turns of ~110k each, 68% of what the run spent (Carlos).
 */

/** The `--role` the lead asks for its own with: `task next --role lead` — what is escalated to it, and what waits for it. */
export const LEAD_ROLE = 'lead';

/** The team's testers: they review every task in review — its QA. */
export const testersOf = async (root: string): Promise<string[]> => {
  const team = await readTeam(root).catch(() => undefined);

  return team ? startedAgents(team).flatMap(each => (each.roles.includes(TESTER) ? [each.agent] : [])) : [];
};

/** The team's scouts: they find out what the spikes ask, and propose the tasks a spike makes to the lead. */
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

/** Who of the team reviews: its testers, and its developers — those a review no tester may take goes to. */
export interface ReviewTeam {
  testers: string[];
  developers: string[];
}

export const reviewTeamOf = async (root: string): Promise<ReviewTeam> => {
  const team = await readTeam(root).catch(() => undefined);
  const started = team ? startedAgents(team) : [];

  return {
    testers: started.flatMap(each => (each.roles.includes(TESTER) ? [each.agent] : [])),
    developers: started.flatMap(each =>
      each.roles.includes(DEVELOPER) && !each.roles.includes(TESTER) ? [each.agent] : []
    )
  };
};

/** No tester may take it: none in the team, or every one worked it. */
export const noTesterFor = (view: TaskView, testers: readonly string[]): boolean =>
  testers.every(tester => workedBy(view, tester));

/**
 * Who reviews a task no tester of the team may take — a lone tester's own tests, above all: its developers that worked
 * neither it nor, for tests, the task they test. None in a team without testers: there the lead reviews every task.
 */
export const spareReviewers = (view: TaskView, views: readonly TaskView[], team: ReviewTeam): string[] => {
  if (team.testers.length === 0 || !noTesterFor(view, team.testers)) {
    return [];
  }

  const tested = views.filter(each => view.task.testsOf?.includes(each.task.id) === true);

  return team.developers.filter(
    developer => !workedBy(view, developer) && !tested.some(each => workedBy(each, developer))
  );
};

/**
 * Whether a task's review is the lead's. By default the lead reviews nothing: only with no tester in the team, or when
 * nobody else may — no tester nor developer that did not work it — and the review would hold the run whole (Carlos).
 */
export const leadReviews = (view: TaskView, views: readonly TaskView[], team: ReviewTeam): boolean =>
  noTesterFor(view, team.testers) && (team.testers.length === 0 || spareReviewers(view, views, team).length === 0);

const viewsOf = (loaded: LoadedRun): Promise<TaskView[]> =>
  Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));

/**
 * A verdict on a task — a tester's, the lead's, a person's, and a developer's on one no tester may take: any other is
 * refused, a designer included once the task's UI is said (its verdict is on the UI, and only while it waits for one).
 * A tester does not review what it worked — its own tests are another's to review.
 */
export const assertReviewingLead = async (ctx: RunContext, loaded: LoadedRun, view: TaskView): Promise<void> => {
  const team = await reviewTeamOf(ctx.root);
  const tester = team.testers.includes(ctx.agent);
  if (tester && workedBy(view, ctx.agent)) {
    throw new RunRefusal(
      'invalid',
      `${ctx.agent} worked ${view.task.id}: its review is another tester's, or a developer's that did not work it — leave it, and go on with plitzi task next`,
      { task: view.task.id }
    );
  }

  const spare =
    !tester &&
    team.developers.includes(ctx.agent) &&
    spareReviewers(view, await viewsOf(loaded), team).includes(ctx.agent);
  if (isPrincipal(ctx.agent) || tester || spare) {
    const { reviewer } = view.state;
    // A tester holds the review it took; `lead` has the last word and may give it on any.
    if (
      !isPrincipal(ctx.agent) &&
      reviewer !== undefined &&
      reviewer.round === view.state.round &&
      reviewer.by !== ctx.agent
    ) {
      throw new RunRefusal('claimed', `${reviewer.by} reviews ${view.task.id}: it is theirs to say`, {
        task: view.task.id,
        holder: reviewer.by
      });
    }

    return;
  }

  const reviewers = [...(await testersOf(ctx.root)), LEAD].join(', ');
  throw new RunRefusal(
    'lead-only',
    `${ctx.agent} is ${(await teamAgents(ctx.root)).includes(ctx.agent) ? 'an agent of the team' : 'no lead of this run'}: a tester says whether ${view.task.id} is done, or the lead (${reviewers})${
      view.state.design?.status === 'due' ? '' : ` — its UI review is ${view.state.design ? 'said' : 'not asked'}`
    }`,
    { task: view.task.id, holder: LEAD }
  );
};

/** A review nobody took this round, or `agent` did. */
const freeFor = (view: TaskView, agent: string): boolean =>
  view.state.reviewer === undefined ||
  view.state.reviewer.round !== view.state.round ||
  view.state.reviewer.by === agent;

/**
 * What a tester reviews: every task but a spike — its QA, a designer's task too: what it was asked, its checks, how it
 * behaves in both schemes and at a phone's width, and that nothing else moved; the look itself is the designer's, which
 * a tester judges only against what was asked. A spike's tasks are the lead's to approve.
 */
export const testerReviews = (task: RunTask): boolean => task.spike === undefined || task.files.length > 0;

/**
 * The review `task next` offers whoever reviews: a task in review whose UI is not waiting for a designer, nobody else took
 * — the one this reviewer reviewed before first (it knows what it asked), then the most urgent (`byUrgency`), then the
 * one that waited longest.
 */
export const leadReviewFor = (
  views: readonly TaskView[],
  agent: string,
  /**
   * Whether a UI review no designer took is this reviewer's too, rather than one that waits for nobody: every one — no
   * designer free — or those it says (queued past their time).
   */
  uiToo: boolean | ((view: TaskView) => boolean) = false
): TaskView | undefined => {
  const urgency = byUrgency(views.map(view => view.task));

  return views
    .filter(
      view =>
        view.state.status === 'in-review' &&
        (view.state.design?.status !== 'due' ||
          ((uiToo === true || (typeof uiToo === 'function' && uiToo(view))) && view.state.design.by === undefined)) &&
        !workedBy(view, agent) &&
        freeFor(view, agent)
    )
    .sort((a, b) => {
      const mine = (view: TaskView): number =>
        view.state.notes.some(note => note.by === agent && /^Review \d+: /.test(note.text)) ? 0 : 1;

      return mine(a) - mine(b) || urgency(a.task, b.task) || a.state.updatedAt.localeCompare(b.state.updatedAt);
    })
    .at(0);
};

/**
 * A look by a tester — by a developer or the lead, at a review that is theirs (`spareReviewers`, `leadReviews`) — at a task whose review is its to take now takes it — said in the
 * activity as `task next` says it: a run's lead looked and approved, and the person following the run saw
 * nobody take its reviews. A look while the designer's UI review is due takes nothing: that review is the designer's.
 */
export const takeOnLook = async (ctx: RunContext, loaded: LoadedRun, view: TaskView): Promise<boolean> => {
  const team = await reviewTeamOf(loaded.paths.root);
  const { testers } = team;
  // The lead's look takes a review only where it is the reviewer — nobody else may take it — and a developer's one no
  // tester may take. Otherwise it is a look.
  const views = ctx.agent === LEAD || team.developers.includes(ctx.agent) ? await viewsOf(loaded) : [];
  const reviews =
    (ctx.agent === LEAD && leadReviews(view, views, team)) ||
    (testers.includes(ctx.agent) && testerReviews(view.task) && !workedBy(view, ctx.agent)) ||
    spareReviewers(view, views, team).includes(ctx.agent);
  const taken = view.state.reviewer?.by === ctx.agent && view.state.reviewer.round === view.state.round;
  if (!reviews || taken || view.state.status !== 'in-review') {
    return false;
  }

  // A UI review nobody took is the reviewer's once it reads it: a run's lead looked at a task as the watch said to, and
  // its designer took the review meanwhile — the lead's approval was refused.
  if (view.state.design?.status === 'due') {
    // A tester's look takes it only where it is its: no designer free for it, or queued past its time — a designer free
    // reviews it as a designer would.
    const its = ctx.agent === LEAD || uiQueued(view, ctx.now().getTime()) || (await noDesignerFreeAt(ctx, loaded));

    return view.state.design.by === undefined && its ? takeUiReview(ctx, view) : false;
  }

  return takeLeadReview(ctx, view);
};

/** Whether every designer of the team is at a task of its own — or the team has none: a UI review waits for nobody. */
const noDesignerFreeAt = async (ctx: RunContext, loaded: LoadedRun): Promise<boolean> => {
  const team = await readTeam(ctx.root).catch(() => undefined);
  const designers = (team ? startedAgents(team) : []).filter(each => each.roles.includes(DESIGNER));
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));

  return designers.every(each => views.some(view => view.owner?.agent === each.agent && isWorked(view.state.status)));
};

/**
 * A UI review due that no designer took, taken by whoever reviews — as a designer takes one (`takeDesignReview`), written here:
 * `design.ts` reaches this module through the run's own, and importing it closes a cycle.
 */
const takeUiReview = async (ctx: RunContext, view: TaskView): Promise<boolean> => {
  const at = ctx.now().toISOString();
  const after = await updateState(
    view.paths,
    state =>
      state.status === 'in-review' && state.design?.status === 'due' && state.design.by === undefined
        ? { ...state, design: { ...state.design, by: ctx.agent, at } }
        : state,
    ctx.now
  );

  return after.design?.by === ctx.agent;
};

export const takeLeadReview = async (ctx: RunContext, view: TaskView): Promise<boolean> => {
  const at = ctx.now().toISOString();
  const after = await updateState(
    view.paths,
    state =>
      state.status === 'in-review' &&
      (state.reviewer === undefined || state.reviewer.round !== state.round || state.reviewer.by === ctx.agent)
        ? { ...state, reviewer: { by: ctx.agent, round: state.round, at } }
        : state,
    ctx.now
  );

  return after.reviewer?.by === ctx.agent && after.reviewer.round === after.round;
};
