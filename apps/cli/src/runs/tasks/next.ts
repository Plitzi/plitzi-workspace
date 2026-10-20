import { durationText } from '../../options';
import { designReviewFor, hasDesignReview, takeDesignReview } from '../design';
import { isCoLead, isPrincipal, LEAD_ROLE, leadReviewFor, takeLeadReview } from '../leads';
import { agentAddress, unreadFor } from '../messages';
import { pagesOf } from '../pagesOf';
import { readyTasks } from '../plan';
import { isRunRefusal, RunRefusal } from '../refusal';
import { assertStatus, loadRun } from '../run';
import { isDisconnected, viewTask } from '../taskStore';
import { DESIGNER } from '../team';
import { findTask, roleOf } from './common';
import { takeTask } from './take';

import type { Message } from '../messages';
import type { RunRecord, RunTask, TaskStatus } from '../model';
import type { RunContext } from '../run';
import type { TaskView } from '../taskStore';
import type { TakenTask } from './take';

/**
 * `plitzi task next`: what an agent between tasks is handed — its own task back, a designer's review, the next ready
 * task — and waiting for one (`--follow`), taking it in the same breath (`--take`).
 */

export interface NextTask {
  task?: RunTask;
  /**
   * The task is one the caller already holds and can go on with — a block lifted, changes requested: no take, its token
   * is still good.
   */
  yours?: 'in-progress' | 'changes-requested';
  /** Handed back with changes requested: what its last review asked, by whom. */
  asked?: string[];
  /**
   * A designer's, before any task: one whose UI waits for its review — looked at as it went to review (`task look`),
   * then said (`task review --approve | --changes`). What it changed, for the look.
   */
  designReview?: {
    task: RunTask;
    round: number;
    changed: string[];
    /** Where its changes are drawn, to look at: the pages that own its files. */
    pages: string[];
    /** Sent back since a designer last looked: what the lead's reviews asked — what this round answers. */
    asked: string[];
  };
  /**
   * A lead's that reviews (`--role lead`): a task in review no other lead took — what it changed, where it is drawn, and
   * what its earlier reviews asked.
   */
  leadReview?: {
    task: RunTask;
    round: number;
    changed: string[];
    pages: string[];
    asked: string[];
    /** A designer approved its UI: what it said, when it said something. */
    design?: string;
  };
  /** Why nothing is ready, when nothing is. */
  why?: string;
  ready: string[];
  /** Nothing is ready, and nothing ever will be for this role: every task of it is done — the agent can stop. */
  finished?: boolean;
  /** Finished: the tasks the caller worked, and where each ended — approved, or still with the lead. */
  worked?: { task: string; status: TaskStatus; finishedBy?: string }[];
  /** What the lead said to the caller by name and it had not read. */
  messages: Message[];
  /** Tasks are ready, but the run's agents are all at work: the caller waits for a place. */
  full?: true;
  /** The run is stopping or stopped: nothing starts until it is resumed. */
  paused?: string;
  /** `--follow` gave up after its timeout, with nothing for the caller. */
  timedOut?: true;
}

/** `plitzi task next`: the ready task to take — highest priority, then the longest chain still to do. */
export const nextTask = async (ctx: RunContext, runId: string, role?: string): Promise<NextTask> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open'], 'start a task');
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const states = new Map(views.map(view => [view.task.id, view.state]));
  const held = new Set(views.filter(view => view.owner).map(view => view.task.id));
  // One role, or several an agent takes — `developer,reviewer`.
  const roles = role
    ?.split(',')
    .map(each => each.trim())
    .filter(Boolean);
  const forRole = (task: RunTask): boolean => roles === undefined || roles.includes(roleOf(task));
  // What the lead said to this agent by name — between tasks, there is nowhere else for it to arrive.
  const messages = await unreadFor(loaded, agentAddress(ctx.agent), true);
  // What the caller holds and can go on with comes before anything new: an agent between tasks waits with `next`, and
  // this is how it hears that its blocked task was unblocked, or that its review asked for changes.
  for (const view of views) {
    const { status } = view.state;
    if (view.owner?.agent === ctx.agent && (status === 'in-progress' || status === 'changes-requested')) {
      // …with what was said to that task meanwhile — an amendment, a review's words — which it reads nowhere else first.
      const toTask = await unreadFor(loaded, view.task.id, true);

      // Sent back: what its last review asked, said where it is handed back — not only in the brief.
      const asked = view.state.notes
        .filter(note => note.text.startsWith(`Review ${String(view.state.round)}: `))
        .map(note => `${note.by}: ${note.text.slice(`Review ${String(view.state.round)}: `.length)}`);

      return {
        task: view.task,
        yours: status,
        ...(status === 'changes-requested' && asked.length > 0 ? { asked } : {}),
        ready: [],
        messages: [...messages, ...toTask].sort((x, y) => x.at.localeCompare(y.at) || x.id.localeCompare(y.id))
      };
    }
  }

  // A lead that reviews is offered reviews, and nothing else: the queue of tasks in review no other lead took.
  if (roles?.includes(LEAD_ROLE) === true) {
    return leadNext(ctx, loaded.record, views, messages);
  }

  // A review holds back a task already done, and the lead: a designer's comes before anything new.
  const designer = loaded.record.designReview === true && roles?.includes(DESIGNER) === true;
  const review = designer ? designReviewFor(views, ctx.agent) : undefined;
  if (review) {
    return {
      designReview: {
        task: review.task,
        round: review.state.round,
        changed: review.state.changed ?? [],
        // Read off its copy: a page the task makes (a dog added to the data) is one to look at too.
        pages: await pagesOf(review.paths.work, review.state.changed ?? []),
        asked: review.state.notes
          .filter(note => /^Review \d+: /.test(note.text))
          .map(note => `${note.by}: ${note.text}`)
      },
      ready: [],
      messages
    };
  }

  const ready = readyTasks(loaded.tasks, states, held).filter(forRole);
  // A task the limit would not let this agent take is not offered: it is said, and `--follow` waits for a place.
  const atWork = new Set(
    views
      .filter(view => view.owner && (view.state.status === 'in-progress' || view.state.status === 'changes-requested'))
      .map(view => view.owner?.agent)
  );
  const full = !atWork.has(ctx.agent) && atWork.size >= loaded.record.agents;
  if (ready.length > 0 && full) {
    return {
      why: `${ready.map(task => task.id).join(', ')} ready, but ${String(atWork.size)} of the ${String(loaded.record.agents)} agents the run allows are at work: it is taken when one of them has nothing in progress`,
      ready: ready.map(task => task.id),
      full: true,
      messages
    };
  }

  if (ready.length > 0) {
    return { task: ready[0], ready: ready.map(task => task.id), messages };
  }

  const open = views.filter(view => view.state.status !== 'done');
  const others = roles === undefined ? [] : readyTasks(loaded.tasks, states, held).filter(task => !forRole(task));
  const coming = views.filter(view => view.state.status !== 'done' && forRole(view.task));
  // A designer is not done while a task whose UI it may review is still to be done — by what it plans to change, or
  // what it changed already (a file of the UI taken by turns, past its own).
  const toReview = designer
    ? views.filter(
        view =>
          view.state.status !== 'done' &&
          hasDesignReview(view.task, [...view.task.files, ...(view.state.changed ?? [])])
      )
    : [];
  const why =
    roles !== undefined && coming.length === 0 && toReview.length > 0
      ? `no task is left for a ${String(role)} to work: the UI of ${toReview.map(view => `${view.task.id} (${view.state.status})`).join(', ')} is yours to review once it is in review — wait for it (--follow)`
      : others.length > 0
        ? `nothing ready for a ${String(role)}: ready for others — ${others.map(task => `${task.id} (${roleOf(task)})`).join(', ')}`
        : roles !== undefined && coming.length === 0
          ? `no task is left for a ${String(role)}: every one is done`
          : open.length === 0
            ? 'every task is done: the run is ready to finish (plitzi run finish)'
            : `nothing is ready: ${open
                .map(
                  view =>
                    `${view.task.id} ${view.state.status}${
                      view.state.status === 'pending'
                        ? ` (waits for ${view.task.dependsOn.filter(dependency => states.get(dependency)?.status !== 'done').join(', ')})`
                        : ''
                    }${
                      view.owner
                        ? ` (${view.owner.agent}${isDisconnected(view.task, view.signalAt, ctx.now()) ? ', no signal — the lead may reassign it' : ''})`
                        : ''
                    }`
                )
                .join(', ')}`;

  const finished = open.length === 0 || (roles !== undefined && coming.length === 0 && toReview.length === 0);
  // An agent done with the run hears how its own work ended: its copies are gone, and the run may end before it asks.
  const worked = views
    .filter(view => view.state.notes.some(note => note.by === ctx.agent && note.text.startsWith('Taken')))
    .map(view => {
      // Reverted and redone, or cut and taken over: whose work it ends as is the last taker's, said so.
      const last = view.state.notes.filter(note => note.text.startsWith('Taken')).at(-1)?.by;

      return {
        task: view.task.id,
        status: view.state.status,
        ...(last !== undefined && last !== ctx.agent ? { finishedBy: last } : {})
      };
    });

  return {
    // Finished, it says so: what is ready for other roles is no reason to wait.
    why:
      finished && roles !== undefined && open.length > 0
        ? `${loaded.tasks.some(forRole) ? `no task is left for a ${String(role)}: every one is done` : `no task in this run is a ${String(role)}'s`} — what is left is for others (${others.map(task => task.id).join(', ') || 'in their hands'}). You can stop`
        : why,
    ready: [],
    messages,
    ...(finished ? { finished: true, worked } : {})
  };
};

/** `task next --role lead`: the review a lead takes next, why there is none, or that the run has none left for it. */
const leadNext = async (
  ctx: RunContext,
  record: RunRecord,
  views: readonly TaskView[],
  messages: Message[]
): Promise<NextTask> => {
  if (!isCoLead(record, ctx.agent) && !isPrincipal(ctx.agent)) {
    throw new RunRefusal(
      'invalid',
      `${ctx.agent} is no lead of this run: its leads are lead${(record.leads ?? []).map(each => `, ${each}`).join('')} — a lead that reviews waits with plitzi task next --role lead --agent <its name>`
    );
  }

  const review = leadReviewFor(views, ctx.agent);
  if (review) {
    const approvedUi = review.state.design?.status === 'approved' ? review.state.design : undefined;

    return {
      leadReview: {
        task: review.task,
        round: review.state.round,
        changed: review.state.changed ?? [],
        pages: await pagesOf(review.paths.work, review.state.changed ?? []),
        asked: review.state.notes
          .filter(note => /^Review \d+: /.test(note.text))
          .map(note => `${note.by}: ${note.text}`),
        ...(approvedUi
          ? {
              design:
                review.state.notes.findLast(note => note.text.startsWith('Its UI approved by'))?.text ??
                `its UI approved by ${approvedUi.by ?? 'a designer'}`
            }
          : {})
      },
      ready: [],
      messages
    };
  }

  const open = views.filter(view => view.state.status !== 'done');
  if (open.length === 0) {
    return { why: 'every task is done: no review is left — you can stop', ready: [], messages, finished: true };
  }

  const taken = views.filter(
    view =>
      view.state.status === 'in-review' &&
      view.state.reviewer?.round === view.state.round &&
      view.state.reviewer.by !== ctx.agent
  );
  const designs = views.filter(view => view.state.status === 'in-review' && view.state.design?.status === 'due');

  return {
    why: `no review waits for you: ${[
      ...taken.map(view => `${view.task.id} is ${String(view.state.reviewer?.by)}'s`),
      ...designs.map(view => `${view.task.id} waits for its UI review`),
      `${String(open.length - taken.length - designs.length)} task(s) still being worked`
    ].join(', ')} — wait for one (--follow)`,
    ready: [],
    messages
  };
};

/**
 * `plitzi task next --follow`: waits until a task is ready for the role — another task approved, a block lifted — the
 * lead says something to the agent, or none ever will be (every task of it done), or `timeoutMs` passes. What an agent between tasks runs, rather than
 * stopping because nothing is ready this very moment.
 */
/**
 * `plitzi task next --take`: the next task, taken in the same breath. Another agent taking the one offered meanwhile is
 * no refusal: the next ready one is tried. A task handed back as the caller's own (`yours`) is not taken again — its
 * token is still good. One that cannot be taken for another reason is refused as `take` refuses it.
 */
export const takeNext = async (
  ctx: RunContext,
  runId: string,
  role: string | undefined,
  follow?: { timeoutMs: number; everyMs?: number }
): Promise<{ next: NextTask; taken?: TakenTask }> => {
  const started = Date.now();
  const tried = new Set<string>();
  for (;;) {
    const next = follow
      ? await followNext(ctx, runId, role, {
          ...follow,
          timeoutMs: Math.max(0, follow.timeoutMs - (Date.now() - started))
        })
      : await nextTask(ctx, runId, role);
    // A review is taken as its own — another designer that took it first is no refusal: the next is offered.
    if (next.designReview) {
      const offered = next.designReview.task.id;
      const loaded = await loadRun(ctx, runId);
      if (
        tried.has(offered) ||
        (await takeDesignReview(ctx, await viewTask(loaded.paths, findTask(loaded, offered))))
      ) {
        return { next };
      }

      tried.add(offered);
      continue;
    }

    if (next.leadReview) {
      const offered = next.leadReview.task.id;
      const loaded = await loadRun(ctx, runId);
      if (tried.has(offered) || (await takeLeadReview(ctx, await viewTask(loaded.paths, findTask(loaded, offered))))) {
        return { next };
      }

      tried.add(offered);
      continue;
    }

    if (!next.task || next.yours) {
      return { next };
    }

    const offered = next.task;
    try {
      return { next, taken: await takeTask(ctx, runId, offered.id, role === undefined ? undefined : roleOf(offered)) };
    } catch (error) {
      // Taken by another agent meanwhile — once: a task offered again after that is held for a reason of its own.
      if (!isRunRefusal(error) || error.code !== 'claimed' || tried.has(offered.id)) {
        throw error;
      }

      tried.add(offered.id);
    }
  }
};

export const followNext = async (
  ctx: RunContext,
  runId: string,
  role: string | undefined,
  { timeoutMs = 30 * 60_000, everyMs = 10_000 } = {}
): Promise<NextTask> => {
  const started = Date.now();
  for (;;) {
    // A run stopped — gently, by its brake, or by a person at once — goes on once resumed, and one whose Plitzi was
    // upgraded once a person re-pins it: an agent waiting for work waits through either.
    const next = await nextTask(ctx, runId, role).catch((error: unknown): NextTask => {
      if (
        isRunRefusal(error) &&
        (error.code === 'stopping' || error.code === 'forced-stop' || error.code === 'version-mismatch')
      ) {
        return { ready: [], messages: [], why: error.message, paused: error.message };
      }

      throw error;
    });
    if (next.task || next.designReview || next.leadReview || next.finished || next.messages.length > 0) {
      return next;
    }

    if (Date.now() - started >= timeoutMs) {
      return {
        ...next,
        timedOut: true,
        why: `waited ${durationText(timeoutMs)} and nothing came for you: ${next.why ?? 'nothing is ready'} — run it again to go on waiting`
      };
    }

    await new Promise(resolve => setTimeout(resolve, everyMs));
  }
};
