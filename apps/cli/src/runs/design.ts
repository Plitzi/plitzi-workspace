import path from 'node:path';

import { fingerprint } from './files';
import { agentAddress, LEAD, sendMessage } from './messages';
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
export const designReviewFor = (views: readonly TaskView[], agent: string, now: number): TaskView | undefined => {
  const urgency = byUrgency(views.map(view => view.task));
  // A round the designer before said is its own first; another's once it waited for that one past `SAME_DESIGNER_MS`.
  const mine = (view: TaskView): boolean => view.state.design?.before === agent;
  const anothers = (view: TaskView): boolean => {
    const { before, since } = view.state.design ?? {};

    return before !== undefined && before !== agent && now - Date.parse(since ?? '') < SAME_DESIGNER_MS;
  };

  return views
    .filter(
      view =>
        designDue(view.state) &&
        view.owner?.agent !== agent &&
        (view.state.design?.by === undefined ||
          view.state.design.by === agent ||
          timedOut(view.state.design, now) !== undefined) &&
        !anothers(view)
    )
    .sort(
      (a, b) =>
        Number(mine(b)) - Number(mine(a)) ||
        urgency(a.task, b.task) ||
        a.state.updatedAt.localeCompare(b.state.updatedAt)
    )
    .at(0);
};

/** How long a sent-back task's UI waits for the designer who said its round before, before another is offered it. */
export const SAME_DESIGNER_MS = 3 * 60_000;

/**
 * How long a UI review is its designer's once taken: past it, another designer takes it, or the lead decides it — the
 * designer told. velada-fidelity's design-1 held one 16 min, and a task waited 18 min queued behind it: the run's time
 * went to one agent's review while the developers sat free.
 */
export const REVIEW_TIMEOUT_MS = 8 * 60_000;

/** How long a UI review due waits untaken before the lead is told to review it itself. */
export const REVIEW_QUEUE_MS = 5 * 60_000;

/** The minutes a taken review is past its time, if it is: none while it is in time, or untaken. */
export const timedOut = (design: DesignReview | undefined, now: number): number | undefined => {
  if (design?.status !== 'due' || design.by === undefined || design.at === undefined) {
    return undefined;
  }

  const held = now - Date.parse(design.at);

  return held > REVIEW_TIMEOUT_MS ? Math.round(held / 60_000) : undefined;
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
    throw new RunRefusal(
      'claimed',
      `${design.by} reviews ${taskId}'s UI: it is theirs to say — a review taken is its designer's for ${String(REVIEW_TIMEOUT_MS / 60_000)} min, and one held past it goes to another. What you found, say for the next run: plitzi run notice "…" --on <element>`,
      { task: taskId, holder: design.by }
    );
  }

  if (workedBy(view, agent)) {
    throw new RunRefusal(
      'invalid',
      `${agent} worked ${taskId}: its UI is reviewed by another designer, or the lead approves it without that review, as itself (plitzi task review ${taskId} --approve --skip-design lead --token <the lead's>)`,
      { task: taskId }
    );
  }
};

/**
 * `task next --take`, for a designer: the review it was offered, its own — false when another designer took it first.
 * One another designer held past its time is taken from it: who it was is said back, for it to be told.
 */
export const takeDesignReview = async (
  ctx: RunContext,
  view: TaskView
): Promise<{ taken: boolean; from?: string; minutes?: number }> => {
  const now = ctx.now().getTime();
  const before = view.state.design?.by;
  const late = timedOut(view.state.design, now);
  const after = await updateState(
    view.paths,
    state =>
      designDue(state) &&
      state.design &&
      (state.design.by === undefined || state.design.by === ctx.agent || timedOut(state.design, now) !== undefined)
        ? { ...state, design: { ...state.design, by: ctx.agent, at: ctx.now().toISOString() } }
        : state,
    ctx.now
  );
  const taken = after.design?.by === ctx.agent;

  return taken && before !== undefined && before !== ctx.agent && late !== undefined
    ? { taken, from: before, minutes: late }
    : { taken };
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
  asked?: ReviewAsked,
  now: number = Date.now()
): Promise<{ design?: DesignReview; carried?: string }> => {
  const changesUi = loaded.record.designReview === true && hasDesignReview(view.task, changed);
  if (asked === 'code' && !changesUi) {
    return {
      carried: 'Its developer asked for the code review alone: nothing it changed is to be looked at as a page'
    };
  }

  if (asked !== 'ui' && !changesUi) {
    return {};
  }

  // A developer's "code alone" on files a page draws is not its to say: lx-copy's t-card, a component, skipped its
  // designer that way, and the price-colour bug was what a look finds. Its UI is reviewed; said in its notes.
  const overruled =
    asked === 'code' ? ' — its developer asked for the code review alone, but what it changed draws UI' : '';

  // The lead sent it back saying its next look is the lead's own: no designer is offered it.
  const reserved = view.state.design?.reserved;
  if (reserved !== undefined) {
    return {
      design: { status: 'skipped', round: view.state.round, why: 'lead', by: reserved },
      carried: `Its UI review this round is ${reserved}'s, as ${reserved} said sending it back: it comes to ${reserved} alone`
    };
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

  return {
    design: {
      status: 'due',
      round: view.state.round,
      ...(design?.by === undefined ? {} : { before: design.by }),
      since: new Date(now).toISOString()
    },
    ...(overruled ? { carried: `Its UI is reviewed${overruled}` } : {})
  };
};

/**
 * A review offered to a designer, taken as its own — and logged; one another designer held past its time is taken from
 * it, and that one is told on its next command. False when another designer took it first.
 */
export const takeOfferedReview = async (ctx: RunContext, loaded: LoadedRun, view: TaskView): Promise<boolean> => {
  const took = await takeDesignReview(ctx, view);
  if (!took.taken) {
    return false;
  }

  if (took.from !== undefined) {
    await sendMessage(ctx, loaded, {
      from: LEAD,
      to: agentAddress(took.from),
      text: `${view.task.id}'s UI review went to ${ctx.agent}: you held it ${String(took.minutes)} min, past the ${String(REVIEW_TIMEOUT_MS / 60_000)} a review is a designer's — it is not yours now. What you found, say for the next run: plitzi run notice "…"`
    });
    await logRun(ctx, loaded.paths, {
      action: 'review-timed-out',
      task: view.task.id,
      review: 'ui',
      from: took.from,
      to: ctx.agent,
      minutes: took.minutes
    });
  }

  await logRun(ctx, loaded.paths, { action: 'review-taken', task: view.task.id, review: 'ui' });

  return true;
};
