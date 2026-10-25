import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readJson, writeJson } from './files';
import { LEAD } from './messages';
import { RunRefusal } from './refusal';
import { updateState } from './taskStore';
import { readTeam, startedAgents, TESTER } from './team';
import { byUrgency } from './urgency';

import type { RunRecord, RunTask } from './model';
import type { LoadedRun, RunContext } from './run/context';
import type { TaskView } from './taskStore';

/**
 * A run's leads: `lead`, who plans, answers, decides, finishes and reviews — and, past four agents, the others
 * (`lead-2`…), who review as it does and nothing else, **started only when the reviews queue up**: a lead waiting for a
 * review it is never handed spends tokens on nothing. `lead` reviews every task while none of them runs; once two wait
 * and the oldest waited `REVIEW_BACKLOG_MS`, `run watch` says to start one. A review is taken from one queue
 * (`task next --role lead`), so two leads never review one task; with one of them running, `lead` is woken only for a
 * review none took within `UNTAKEN_REVIEW_MS`; and one handed nothing for `IDLE_LEAD_MS` is told to stop — at once
 * when no review waits and the tasks left are no more than the other leads, who review one each (`spareLead`).
 */

/** The `--role` a lead that reviews waits with: `task next --role lead`. */
export const LEAD_ROLE = 'lead';

/** How long a review waits for another lead before `lead` is woken for it: a lead at `--follow` takes it in seconds. */
export const UNTAKEN_REVIEW_MS = 2 * 60_000;

/** How long the oldest of two reviews waits for `lead` before it is told to start a lead that reviews beside it. */
export const REVIEW_BACKLOG_MS = 5 * 60_000;

/** How long a lead that reviews waits with nothing handed to it before it is told to stop: as long as an agent on demand. */
export const IDLE_LEAD_MS = 4 * 60_000;

/**
 * A lead that reviews is spare when the tasks not approved yet are no more than the other leads running: each reviews
 * one at a time, and what is left is theirs (lead-2 waiting through the run's last task and its
 * integration, the lead there for both).
 */
export const spareLead = (open: number, otherLeads: number): boolean => open <= otherLeads;

/**
 * The team's testers: they review the code of the tasks in review as a lead that reviews does — the same queue, the same
 * verdict — before the tests they write, so the lead reviews only what none of them took within `UNTAKEN_REVIEW_MS`:
 * the testers the bottleneck. A team with none leaves every review to the leads.
 */
export const testersOf = async (root: string): Promise<string[]> => {
  const team = await readTeam(root).catch(() => undefined);

  return team ? startedAgents(team).flatMap(each => (each.roles.includes(TESTER) ? [each.agent] : [])) : [];
};

/** Who reviews beside `lead`: the leads that review, and the testers. */
export const reviewersOf = async (loaded: LoadedRun): Promise<string[]> => [
  ...coLeadsOf(loaded.record),
  ...(await testersOf(loaded.paths.root))
];

/** A lead that reviews asked within this is running: at `--follow` it asks every few seconds. */
const ASKING_MS = 60_000;

const isAsking = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every(each => typeof each === 'string');

/** Records that `agent`, a lead that reviews, asked for a review now. */
export const markAsking = async (ctx: RunContext, loaded: LoadedRun): Promise<void> => {
  const asking =
    (await readJson(loaded.paths.leadsAsking, isAsking, 'when the leads asked').catch(() => undefined)) ?? {};
  await writeJson(loaded.paths.leadsAsking, { ...asking, [ctx.agent]: ctx.now().toISOString() });
};

/** The reviewers running — leads that review, testers: each asked for a review within the last minute. */
export const askingLeads = async (loaded: LoadedRun, now: Date): Promise<string[]> => {
  const asking =
    (await readJson(loaded.paths.leadsAsking, isAsking, 'when the leads asked').catch(() => undefined)) ?? {};

  return (await reviewersOf(loaded)).filter(
    lead => Object.hasOwn(asking, lead) && now.getTime() - Date.parse(asking[lead]) < ASKING_MS
  );
};

/** The one who decides: `lead`, or a person at a terminal. */
export const isPrincipal = (agent: string): boolean => agent === LEAD || agent === 'person';

/** The leads besides `lead` in this run. */
export const coLeadsOf = (record: RunRecord): string[] => record.leads ?? [];

export const isCoLead = (record: RunRecord, agent: string): boolean => coLeadsOf(record).includes(agent);

/** The agents the team starts, by name: none of them is a lead. */
const teamAgents = async (root: string): Promise<string[]> => {
  const team = await readTeam(root).catch(() => undefined);

  return team ? startedAgents(team).map(each => each.agent) : [];
};

/**
 * `lead`'s, or a person's: refused to a lead that reviews, to an agent of the team and to any other — planning,
 * answering, reassigning and finishing are one lead's, or two would do them twice.
 */
export const requireLead = async (ctx: RunContext, loaded: LoadedRun, action: string): Promise<void> => {
  if (isPrincipal(ctx.agent)) {
    return;
  }

  // Who calls is proved (`identity.ts`): any other is refused, named — a name of no team is no way in either.
  throw new RunRefusal(
    'lead-only',
    isCoLead(loaded.record, ctx.agent)
      ? `${ctx.agent} reviews; to ${action} is lead's: tell it what you found, and go on with your reviews`
      : (await teamAgents(ctx.root)).includes(ctx.agent)
        ? `${ctx.agent} is an agent of the team; to ${action} is the lead's`
        : `${ctx.agent} is not the lead; to ${action} is the lead's`,
    { holder: LEAD }
  );
};

/**
 * A lead's — `lead`, a lead that reviews, a person — and no other's: what goes out in the lead's voice (`task message`
 * is from the lead), so a designer or an agent of the team never speaks as it.
 */
export const requireALead = (ctx: RunContext, loaded: LoadedRun, action: string): void => {
  if (isPrincipal(ctx.agent) || isCoLead(loaded.record, ctx.agent)) {
    return;
  }

  throw new RunRefusal(
    'lead-only',
    `${ctx.agent} cannot ${action}: it goes out in the lead's voice — tell the lead (plitzi task tell --about <task> "…"), and it says it`,
    { holder: LEAD }
  );
};

/** Who took a task's work, by the notes its takes leave. */
const workedBy = (view: TaskView, agent: string): boolean =>
  view.state.notes.some(note => note.by === agent && note.text.startsWith('Taken'));

/**
 * A lead's verdict on a task — `lead`, a lead that reviews, a tester, a person: any other is refused, a designer
 * included once the task's UI is said (its verdict is on the UI, and only while it waits for one). A tester does not
 * review what it worked — its own tests are another's to review.
 */
export const assertReviewingLead = async (ctx: RunContext, loaded: LoadedRun, view: TaskView): Promise<void> => {
  const tester = (await testersOf(ctx.root)).includes(ctx.agent);
  if (tester && workedBy(view, ctx.agent)) {
    throw new RunRefusal(
      'invalid',
      `${ctx.agent} worked ${view.task.id}: its review is another tester's or a lead's — leave it, and go on with plitzi task next`,
      { task: view.task.id }
    );
  }

  if (isPrincipal(ctx.agent) || isCoLead(loaded.record, ctx.agent) || tester) {
    const { reviewer } = view.state;
    // A lead that reviews holds the review it took; `lead` has the last word and may give it on any.
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

  const leads = [LEAD, ...(await reviewersOf(loaded))].join(', ');
  throw new RunRefusal(
    'lead-only',
    `${ctx.agent} is ${(await teamAgents(ctx.root)).includes(ctx.agent) ? 'an agent of the team' : 'no lead of this run'}: a lead says whether ${view.task.id} is done (${leads})${
      view.state.design?.status === 'due' ? '' : ` — its UI review is ${view.state.design ? 'said' : 'not asked'}`
    }`,
    { task: view.task.id, holder: LEAD }
  );
};

/** A review no lead took this round, or `agent` did. */
const freeFor = (view: TaskView, agent: string): boolean =>
  view.state.reviewer === undefined ||
  view.state.reviewer.round !== view.state.round ||
  view.state.reviewer.by === agent;

/**
 * The review `task next --role lead` offers a lead: a task in review whose UI is not waiting for a designer, no other
 * lead took — the one this lead reviewed before first (it knows what it asked), then the most urgent (`byUrgency`), then
 * the one that waited longest.
 */
/**
 * What a tester may review, as one who reviews beside the lead: code — a developer's task, another's tests. A design is
 * not its to approve: a run's test-1 approved the identity system and its components, a designer's work no tester
 * reads as one.
 */
export const testerReviews = (task: RunTask): boolean => {
  const role = task.role ?? 'developer';

  // Read as it is called: `team.ts` and this module import each other, and a set made as this one loads read TESTER
  // before it was there.
  return role === 'developer' || role === TESTER;
};

export const leadReviewFor = (
  views: readonly TaskView[],
  agent: string,
  /** No designer is free: a UI review no designer took is the lead's too, rather than one that waits for nobody. */
  uiToo = false
): TaskView | undefined => {
  const urgency = byUrgency(views.map(view => view.task));

  return views
    .filter(
      view =>
        view.state.status === 'in-review' &&
        (view.state.design?.status !== 'due' || (uiToo && view.state.design.by === undefined)) &&
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

/** Takes the review offered: false when another lead took it first. */
/**
 * A look by the lead, or by one who reviews beside it, at a task whose review is its to take now takes it — said in the
 * activity as `task next` says it: a run's lead looked and approved, and the person following the run saw
 * nobody take its reviews. A look while the designer's UI review is due takes nothing: that review is the designer's.
 */
export const takeOnLook = async (ctx: RunContext, loaded: LoadedRun, view: TaskView): Promise<boolean> => {
  const testers = await testersOf(loaded.paths.root);
  const reviews =
    ctx.agent === LEAD ||
    coLeadsOf(loaded.record).includes(ctx.agent) ||
    (testers.includes(ctx.agent) && testerReviews(view.task));
  const taken = view.state.reviewer?.by === ctx.agent && view.state.reviewer.round === view.state.round;
  if (!reviews || taken || view.state.status !== 'in-review') {
    return false;
  }

  // A UI review nobody took is the lead's once it reads it: a run's lead looked at a task as the watch said to, and
  // its designer took the review meanwhile — the lead's approval was refused. A tester reviews code, never the UI.
  if (view.state.design?.status === 'due') {
    const lead = ctx.agent === LEAD || coLeadsOf(loaded.record).includes(ctx.agent);

    return lead && view.state.design.by === undefined ? takeUiReview(ctx, view) : false;
  }

  return takeLeadReview(ctx, view);
};

/**
 * A UI review due that no designer took, taken by a lead — as a designer takes one (`takeDesignReview`), written here:
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
