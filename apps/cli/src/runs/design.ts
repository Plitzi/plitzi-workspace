import path from 'node:path';

import { fingerprint } from './files';
import { RunRefusal } from './refusal';
import { logRun } from './run';
import { updateState } from './taskStore';
import { DESIGNER, readTeam, startedAgents } from './team';
import { isUiFile, reviewedAsUi } from './uiFiles';
import { byUrgency } from './urgency';

import type { DesignReview, Quality, RunTask, TaskState } from './model';
import type { LoadedRun, RunContext } from './run';
import type { TaskView } from './taskStore';

/**
 * The designer's review: in a run with a designer — one in the team, or a designer's task in the plan — the
 * UI another role's task changes is looked at by a designer before the lead: how it reads, not only whether it works.
 * At `complete` such a task is `due` (`TaskState.design`); a designer is offered it by `task next`, looks at it as it
 * went to review (`task look`), and says: changes go back to the task as the lead's would, approval hands it to the lead.
 * The lead approves after — or before, saying so (`--skip-design`), and the report shows which.
 */

/** Whether a designer reviews this task's UI: another role's work that changes what a person sees. */
export const hasDesignReview = (task: RunTask, changed: readonly string[]): boolean =>
  task.kind === 'work' && reviewedAsUi(task.role, changed);

/** The task waits for a designer: in review, its UI not yet said — by anyone, or by `agent` once it took it. */
export const designDue = (state: TaskState): boolean => state.status === 'in-review' && state.design?.status === 'due';

/**
 * The review a designer is offered by `task next`: one due, not one it worked itself, not one another designer took —
 * the most urgent first (`byUrgency`: what other tasks wait on goes before what nobody does), then the one that waited
 * longest.
 */
export const designReviewFor = (views: readonly TaskView[], agent: string): TaskView | undefined => {
  const urgency = byUrgency(views.map(view => view.task));

  return views
    .filter(
      view =>
        designDue(view.state) &&
        view.owner?.agent !== agent &&
        (view.state.design?.by === undefined || view.state.design.by === agent)
    )
    .sort((a, b) => urgency(a.task, b.task) || a.state.updatedAt.localeCompare(b.state.updatedAt))
    .at(0);
};

/**
 * What a designer looks at, by how closely the team asks (`options.designReview`) — the run's skill (`runs.md`) says it
 * whole. What every level holds: the hierarchy and spacing, the theme's tokens, words a person understands.
 */
export const DESIGN_LOOK: Record<Quality, string> = {
  light:
    'its pages at 1440 and 390, in the space’s default scheme: hierarchy and spacing, the theme’s tokens rather than new values, labels and words a person understands. Only what the task changed — not the pages it does not touch, not a pixel comparison',
  standard:
    'how it reads at 1440 and 390, in light and dark: hierarchy and spacing, the theme’s tokens rather than new values, every state (empty, long, loading, error, hover, focus), labels and words a person understands, and that it looks like the rest of the space. Against a reference, its sections (page shot --compare --clip <section>): its dress first — every gradient, glow and ornament the comparison says the reference has and this page lacks is one a visitor sees — then what moves, the sizes it measures, how each control behaves, the phone’s own layout. A state the data never shows, you cannot look at: say it (--note), the lead decides how it is seen',
  high: 'everything standard asks, on every page that reads its files — not only its own — against the reference and against the run before it (that nothing else moved), every state and control, in both schemes and widths. A state the data never shows, you cannot look at: say it (--note), the lead decides how it is seen'
};

/** Who took a task's work, by the notes its takes leave: a designer does not review its own. */
const workedBy = (view: TaskView, agent: string): boolean =>
  view.state.notes.some(note => note.by === agent && note.text.startsWith('Taken'));

/** A designer's verdict on `view` is one it may give: the task's UI waits for it, not another's, and not its own work. */
export const assertDesigner = (view: TaskView, agent: string): void => {
  const taskId = view.task.id;
  const { design } = view.state;
  if (design?.by !== undefined && design.by !== agent) {
    throw new RunRefusal('claimed', `${design.by} reviews ${taskId}'s UI: it is theirs to say`, {
      task: taskId,
      holder: design.by
    });
  }

  if (workedBy(view, agent)) {
    throw new RunRefusal(
      'invalid',
      `${agent} worked ${taskId}: its UI is reviewed by another designer, or the lead approves it without that review, as itself (plitzi task review ${taskId} --approve --skip-design lead --token <the lead's>)`,
      { task: taskId }
    );
  }
};

/** `task next --take`, for a designer: the review it was offered, its own — false when another designer took it first. */
export const takeDesignReview = async (ctx: RunContext, view: TaskView): Promise<boolean> => {
  const after = await updateState(
    view.paths,
    state =>
      designDue(state) && state.design?.by === undefined && state.design
        ? { ...state, design: { ...state.design, by: ctx.agent, at: ctx.now().toISOString() } }
        : state,
    ctx.now
  );

  return after.design?.by === ctx.agent;
};

/**
 * A designer approves a task's UI: the task stays in review, and is the lead's now — with what the designer saw and
 * did not ask to change, when it says it (`--note`): the lead reads it with the task.
 */
export const approveDesign = async (
  ctx: RunContext,
  loaded: LoadedRun,
  view: TaskView,
  note?: string
): Promise<void> => {
  assertDesigner(view, ctx.agent);
  const at = ctx.now().toISOString();
  await updateState(
    view.paths,
    state => ({
      ...state,
      design: { status: 'approved', round: state.round, by: ctx.agent, at },
      notes: [
        ...state.notes,
        { at, by: ctx.agent, text: `Its UI approved by ${ctx.agent}: the lead’s now${note ? ` — ${note}` : ''}` }
      ]
    }),
    ctx.now
  );
  await logRun(ctx, loaded.paths, { action: 'design-review', task: view.task.id, verdict: 'approve' });
};

/**
 * Its design review as it goes to review again: none in a run without one, or for a task that changes no UI; `due` —
 * unless a designer approved it before and its UI is byte for byte what the lead's last review saw, a round of the lead's
 * changes that did not touch it (a fix in a module): then the approval stands, and is said in its notes.
 */
/**
 * What review a task asks for as it is sent: `code` — the lead's, of the code and the acceptance, nothing visible to
 * look at — or `ui` too, its UI looked at by a designer (the lead's too when no designer is free) before the lead's of
 * the code. Left unsaid, the run decides: a run with designers reviews the UI of what changed a page.
 */
export type ReviewAsked = 'code' | 'ui';

export const designAtComplete = async (
  loaded: LoadedRun,
  view: TaskView,
  changed: readonly string[],
  asked?: ReviewAsked
): Promise<{ design?: DesignReview; carried?: string }> => {
  if (asked === 'code') {
    return {
      carried: 'Its developer asked for the code review alone: nothing it changed is to be looked at as a page'
    };
  }

  if (asked !== 'ui' && (loaded.record.designReview !== true || !hasDesignReview(view.task, changed))) {
    return {};
  }

  // A designer does not review its own work: with no other in the team, the review would wait for no one.
  const team = await readTeam(loaded.paths.root);
  const holder = view.owner?.agent;
  const others = team
    ? startedAgents(team).filter(each => each.roles.includes(DESIGNER) && each.agent !== holder)
    : undefined;
  if (others?.length === 0) {
    return {
      carried: `No designer of the team but ${holder ?? 'its own'} worked it: its UI is the lead's to review, with the rest`
    };
  }

  const { design } = view.state;
  const reviewed = view.reviewed?.files;
  if (design?.status === 'approved' && reviewed) {
    const ui = [...new Set([...changed, ...Object.keys(reviewed)])].filter(isUiFile);
    const same = await Promise.all(
      ui.map(async file =>
        Object.hasOwn(reviewed, file) ? (await fingerprint(path.join(view.paths.work, file))) === reviewed[file] : false
      )
    );
    if (same.every(Boolean)) {
      return {
        design: { ...design, round: view.state.round },
        carried: `Its UI is as ${design.by ?? 'the designer'} approved it: that review stands for this round`
      };
    }
  }

  return { design: { status: 'due', round: view.state.round } };
};
