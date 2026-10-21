import path from 'node:path';

import { fingerprint } from './files';
import { RunRefusal } from './refusal';
import { logRun } from './run';
import { updateState } from './taskStore';
import { DESIGNER, DEVELOPER, readTeam, startedAgents, TESTER } from './team';

import type { DesignReview, RunTask, TaskState } from './model';
import type { LoadedRun, RunContext } from './run';
import type { TaskView } from './taskStore';

/**
 * The designer's review: in a run with a designer — one in the team, or a designer's task in the plan — the
 * UI another role's task changes is looked at by a designer before the lead: how it reads, not only whether it works.
 * At `complete` such a task is `due` (`TaskState.design`); a designer is offered it by `task next`, looks at it as it
 * went to review (`task look`), and says: changes go back to the task as the lead's would, approval hands it to the lead.
 * The lead approves after — or before, saying so (`--skip-design`), and the report shows which.
 */

/** What a person sees: the space's document — pages, layouts, components, the theme — and the plugins drawn in it. */
const UI_FILE = /^src\/(?:space|plugins)\//;
const NOT_UI = /\.(?:test|spec)\.[cm]?[jt]sx?$|^src\/space\/data\//;

/** Whether a designer reviews this task's UI: another role's work that changes what a person sees. */
export const hasDesignReview = (task: RunTask, changed: readonly string[]): boolean =>
  task.kind === 'work' &&
  ![DESIGNER, TESTER].includes(task.role ?? DEVELOPER) &&
  changed.some(file => UI_FILE.test(file) && !NOT_UI.test(file));

/** The task waits for a designer: in review, its UI not yet said — by anyone, or by `agent` once it took it. */
export const designDue = (state: TaskState): boolean => state.status === 'in-review' && state.design?.status === 'due';

/**
 * The review a designer is offered by `task next`: one due, not one it worked itself, not one another designer took —
 * the one that waited longest, which holds the rest back.
 */
export const designReviewFor = (views: readonly TaskView[], agent: string): TaskView | undefined =>
  views
    .filter(
      view =>
        designDue(view.state) &&
        view.owner?.agent !== agent &&
        (view.state.design?.by === undefined || view.state.design.by === agent)
    )
    .sort((a, b) => a.state.updatedAt.localeCompare(b.state.updatedAt))
    .at(0);

/** What a designer looks at, said once — the run's skill (`runs.md`) says it whole. */
export const DESIGN_LOOK =
  'how it reads at 1440 and 390, in light and dark: hierarchy and spacing, the theme’s tokens rather than new values, every state (empty, long, loading, error, hover, focus), labels and words a person understands, and that it looks like the rest of the space. Against a reference, the details too: what moves (an entrance, a hover, a shine, an arrow), the sizes it measures (page shot --compare says each text’s and box’s), how each control behaves (hover, focus, what a click does), and the phone’s own layout (a carousel where the desktop has a grid). A state the data never shows, you cannot look at: say it (--note), the lead decides how it is seen';

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
      `${agent} worked ${taskId}: its UI is reviewed by another designer, or the lead approves it without that review, as itself (plitzi task review ${taskId} --approve --skip-design --agent lead)`,
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

const isUiFile = (file: string): boolean => UI_FILE.test(file) && !NOT_UI.test(file);

/**
 * Its design review as it goes to review again: none in a run without one, or for a task that changes no UI; `due` —
 * unless a designer approved it before and its UI is byte for byte what the lead's last review saw, a round of the lead's
 * changes that did not touch it (a fix in a module): then the approval stands, and is said in its notes.
 */
export const designAtComplete = async (
  loaded: LoadedRun,
  view: TaskView,
  changed: readonly string[]
): Promise<{ design?: DesignReview; carried?: string }> => {
  if (loaded.record.designReview !== true || !hasDesignReview(view.task, changed)) {
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
