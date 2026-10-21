import fs from 'node:fs/promises';

import { durationText, FOLLOW_MS } from '../../options';
import { designReviewFor, hasDesignReview, takeDesignReview } from '../design';
import { IDLE_LEAD_MS, isCoLead, isPrincipal, LEAD_ROLE, leadReviewFor, markAsking, takeLeadReview } from '../leads';
import { agentAddress, unreadFor } from '../messages';
import { pagesOf } from '../pagesOf';
import { agentScratch, runPaths } from '../paths';
import { readyTasks } from '../plan';
import { isRunRefusal, RunRefusal } from '../refusal';
import { assertStatus, loadRun, logRun, readRunLog } from '../run';
import { runChanged } from '../runChanged';
import { tellLeftInTmp } from '../strays';
import { isDisconnected, viewTask } from '../taskStore';
import { DEFAULT_DESIGN_REVIEW, DESIGNER, qualityRank, readTeam, startedAgents } from '../team';
import { isWorked } from '../worked';
import { findTask, roleOf } from './common';
import { allLocks } from './locks';
import { takeTask } from './take';

import type { Message } from '../messages';
import type { Quality, RunTask, TaskStatus } from '../model';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';
import type { TakenTask } from './take';

/**
 * `plitzi task next`: what an agent between tasks is handed — its own task back, a designer's review, the next ready
 * task — and waiting for one (`--follow`), taking it in the same breath (`--take`).
 */

export interface NextTask {
  task?: RunTask;
  /** The caller's own folder in the run, for what it writes beside its work — made, so it is there to write in. */
  scratch: string;
  /**
   * The task is one the caller already holds and can go on with — a block lifted, changes requested: no take, its token
   * is still good.
   */
  yours?: 'in-progress' | 'changes-requested' | 'spike';
  /** Handed back with changes requested: what its last review asked, by whom. */
  asked?: string[];
  /** One the caller holds: where its copy is — the only place its work is written. */
  work?: string;
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
    /** Sent back since a designer last looked: what the last review asked — what this round answers. */
    asked: string[];
    /** The notes of the reviews before the last: counted, not repeated — `task show` has them whole. */
    earlier: number;
    /** Its copy, as it went to review: what to read its files in (`task look` serves it). */
    copy: string;
    /** How closely the team asks it reviewed (`options.designReview` in team.json). */
    precision: Quality;
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
    earlier: number;
    copy: string;
    /** A designer approved its UI: what it said, when it said something. */
    design?: string;
    /** Its UI review waits for a designer and none is free: the lead's too, said how. */
    uiToo?: string;
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

/** `plitzi task next`: the ready task to take — the most urgent (its priority, or the highest of what waits on it), then the longest chain still to do. */
/** Logs `joined` the first time an agent asks the run for work — kept as the scratch folder it is given. */
const markJoined = async (ctx: RunContext, loaded: LoadedRun): Promise<void> => {
  const scratch = agentScratch(loaded.paths, ctx.agent);
  if (
    await fs.stat(scratch).then(
      () => true,
      () => false
    )
  ) {
    return;
  }

  await logRun(ctx, loaded.paths, {
    action: 'joined',
    ...(ctx.quality === undefined ? {} : { quality: ctx.quality })
  });
};

export const nextTask = async (ctx: RunContext, runId: string, role?: string): Promise<NextTask> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open'], 'start a task');
  // An agent's first ask is its arrival: the run's activity says who worked it, from when, at which level.
  await markJoined(ctx, loaded);
  // Told before the messages are read, so an agent that left something in the project's tmp/ hears it in this answer.
  await tellLeftInTmp(ctx, loaded);
  const scratch = agentScratch(loaded.paths, ctx.agent);
  await fs.mkdir(scratch, { recursive: true });

  const next = await nextOf(ctx, loaded, role);
  // Nothing left for it, ever: the activity says the agent stops, and why — never a silence read as a hang.
  if (next.finished) {
    await logRun(ctx, loaded.paths, { action: 'stops', why: next.why ?? 'nothing is left for it' });
  }

  return { ...next, scratch };
};

const nextOf = async (ctx: RunContext, loaded: LoadedRun, role?: string): Promise<Omit<NextTask, 'scratch'>> => {
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
    if (view.owner?.agent === ctx.agent && isWorked(status)) {
      // …with what was said to that task meanwhile — an amendment, a review's words — which it reads nowhere else first.
      const toTask = await unreadFor(loaded, view.task.id, true);

      // Sent back: what its last review asked, said where it is handed back — not only in the brief.
      const asked = view.state.notes
        .filter(note => note.text.startsWith(`Review ${String(view.state.round)}: `))
        .map(note => `${note.by}: ${note.text.slice(`Review ${String(view.state.round)}: `.length)}`);

      return {
        task: view.task,
        yours: status,
        work: view.paths.work,
        ...(status === 'changes-requested' && asked.length > 0 ? { asked } : {}),
        ready: [],
        messages: [...messages, ...toTask].sort((x, y) => x.at.localeCompare(y.at) || x.id.localeCompare(y.id))
      };
    }
  }

  // A lead that reviews is offered reviews, and nothing else: the queue of tasks in review no other lead took.
  if (roles?.includes(LEAD_ROLE) === true) {
    return leadNext(ctx, loaded, views, messages);
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
        ...askedOf(review.state.notes),
        copy: review.paths.work,
        precision: (await readTeam(ctx.root).catch(() => undefined))?.options?.designReview ?? DEFAULT_DESIGN_REVIEW
      },
      ready: [],
      messages
    };
  }

  // Started at a level, an agent is handed tasks of it or below: a stronger model is for the tasks that ask for one.
  const fits = (task: RunTask): boolean =>
    ctx.quality === undefined || qualityRank(task.quality ?? 'standard') <= qualityRank(ctx.quality);
  const above = readyTasks(loaded.tasks, states, held).filter(task => forRole(task) && !fits(task));
  // A task whose file another task holds is not offered: taking it would be refused (`claimed`), and an agent refused
  // three times stops — la-velada's integration of home/index.ts, while the task holding it was sent back.
  const locks = await allLocks(ctx);
  const holderOfFile = (task: RunTask): { file: string; task: string } | undefined => {
    for (const file of task.files) {
      const other = (locks.get(file) ?? []).find(
        each => each.live && !(each.run === loaded.record.runId && each.task === task.id)
      );
      if (other) {
        return { file, task: other.task };
      }
    }

    return undefined;
  };
  const fitting = readyTasks(loaded.tasks, states, held).filter(task => forRole(task) && fits(task));
  const ready = fitting.filter(task => holderOfFile(task) === undefined);
  const waitingForFile = fitting.flatMap(task => {
    const holder = holderOfFile(task);

    return holder ? [{ waiting: task.id, file: holder.file, holder: holder.task }] : [];
  });
  // A task the limit would not let this agent take is not offered: it is said, and `--follow` waits for a place.
  const atWork = new Set(
    views.filter(view => view.owner && isWorked(view.state.status)).map(view => view.owner?.agent)
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

  // A designer takes no task of its own while others are at work on a UI it will review: their reviews come soon, and
  // one at a task of its own leaves every one of them to the lead (la-velada's motion stage: the designer at a fight's
  // page for twenty minutes, nine UI reviews the lead's). Nothing coming its way, it works as any developer.
  const reviewsComing = designer
    ? views.filter(
        view =>
          view.owner !== undefined &&
          view.owner.agent !== ctx.agent &&
          isWorked(view.state.status) &&
          hasDesignReview(view.task, [...view.task.files, ...(view.state.changed ?? [])])
      )
    : [];
  if (ready.length > 0 && reviewsComing.length > 0) {
    return {
      why: `UI reviews are coming — ${reviewsComing.map(view => `${view.task.id} (${view.owner?.agent ?? ''})`).join(', ')} at work: a designer waits for them rather than taking a task of its own (--follow), and takes one once none is coming`,
      ready: ready.map(task => task.id),
      messages
    };
  }

  if (ready.length > 0) {
    return { task: ready[0], ready: ready.map(task => task.id), messages };
  }

  if (ready.length === 0 && waitingForFile.length > 0) {
    return {
      why: `ready, but a file of each is another task's until that one is approved: ${waitingForFile.map(each => `${each.waiting} (${each.file}, held by ${each.holder})`).join(', ')} — wait for it (--follow)`,
      ready: [],
      messages
    };
  }

  if (ready.length === 0 && above.length > 0) {
    return {
      why: `ready, but above the ${String(ctx.quality)} you were started at: ${above.map(task => `${task.id} (${task.quality ?? 'standard'})`).join(', ')} — the lead starts an agent at that level for it`,
      ready: [],
      messages
    };
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

  // Never while a task of its own is in review: one sent back comes back to it, and nobody else redoes it.
  const ownInReview = views.some(view => view.owner?.agent === ctx.agent && view.state.status === 'in-review');
  const finished =
    !ownInReview && (open.length === 0 || (roles !== undefined && coming.length === 0 && toReview.length === 0));
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
  loaded: LoadedRun,
  views: readonly TaskView[],
  messages: Message[]
): Promise<Omit<NextTask, 'scratch'>> => {
  const { record } = loaded;
  if (!isCoLead(record, ctx.agent) && !isPrincipal(ctx.agent)) {
    throw new RunRefusal(
      'invalid',
      `${ctx.agent} is no lead of this run: its leads are lead${(record.leads ?? []).map(each => `, ${each}`).join('')} — a lead that reviews waits with plitzi task next --role lead --agent <its name>`
    );
  }

  // Asking is running: while it is, `lead` leaves the reviews to it.
  if (isCoLead(record, ctx.agent)) {
    await markAsking(ctx, loaded);
  }

  // A UI review waits for a designer; with none free — each at a task of its own, or none in the team — it waits for
  // nobody, and every review behind it with it (la-velada: seven tasks in review, the one designer redoing its own).
  const team = await readTeam(ctx.root).catch(() => undefined);
  const designers = (team ? startedAgents(team) : [])
    .filter(each => each.roles.includes(DESIGNER))
    .map(each => each.agent);
  const busy = (agent: string): boolean =>
    views.some(view => view.owner?.agent === agent && isWorked(view.state.status));
  const noDesignerFree = designers.every(busy);
  const review = leadReviewFor(views, ctx.agent, noDesignerFree);
  if (review) {
    const approvedUi = review.state.design?.status === 'approved' ? review.state.design : undefined;
    const uiToo = review.state.design?.status === 'due';

    return {
      leadReview: {
        task: review.task,
        round: review.state.round,
        changed: review.state.changed ?? [],
        pages: await pagesOf(review.paths.work, review.state.changed ?? []),
        ...askedOf(review.state.notes),
        copy: review.paths.work,
        ...(approvedUi
          ? {
              design:
                review.state.notes.findLast(note => note.text.startsWith('Its UI approved by'))?.text ??
                `its UI approved by ${approvedUi.by ?? 'a designer'}`
            }
          : {}),
        ...(uiToo
          ? {
              uiToo: `its UI waits for a designer and none is free${designers.length > 0 ? ` (${designers.join(', ')} at a task of its own)` : ''}: review its UI too — as the original, both schemes, the phone width — and approve with --skip-design lead, which the report says as the lead's UI review`
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
      if (tried.has(offered)) {
        return { next };
      }

      if (await takeDesignReview(ctx, await viewTask(loaded.paths, findTask(loaded, offered)))) {
        await logRun(ctx, loaded.paths, { action: 'review-taken', task: offered, review: 'ui' });

        return { next };
      }

      tried.add(offered);
      continue;
    }

    if (next.leadReview) {
      const offered = next.leadReview.task.id;
      const loaded = await loadRun(ctx, runId);
      if (tried.has(offered)) {
        return { next };
      }

      if (await takeLeadReview(ctx, await viewTask(loaded.paths, findTask(loaded, offered)))) {
        await logRun(ctx, loaded.paths, {
          action: 'review-taken',
          task: offered,
          review: next.leadReview.uiToo ? 'lead, UI too' : 'lead'
        });

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

/**
 * What a task's reviews asked, as the next review is handed it: the last review's notes whole, the earlier ones counted —
 * each round's hand-off repeated every review before it whole (velada-now's t-boxer, round 4).
 */
const askedOf = (notes: readonly { by: string; text: string }[]): { asked: string[]; earlier: number } => {
  const reviews = notes.flatMap(note => {
    const round = /^Review (\d+): /.exec(note.text)?.[1];

    return round === undefined ? [] : [{ round: Number(round), line: `${note.by}: ${note.text}` }];
  });
  const last = Math.max(0, ...reviews.map(each => each.round));

  return {
    asked: reviews.filter(each => each.round === last).map(each => each.line),
    earlier: reviews.filter(each => each.round !== last).length
  };
};

export const followNext = async (
  ctx: RunContext,
  runId: string,
  role: string | undefined,
  { timeoutMs = FOLLOW_MS, everyMs = 10_000, idleMs = IDLE_LEAD_MS } = {}
): Promise<NextTask> => {
  const started = Date.now();
  let saidWaiting: string | undefined;
  const idleLead =
    role
      ?.split(',')
      .map(each => each.trim())
      .includes(LEAD_ROLE) === true && !isPrincipal(ctx.agent);
  for (;;) {
    // A run stopped — gently, by its brake, or by a person at once — goes on once resumed, and one whose Plitzi was
    // upgraded once a person re-pins it: an agent waiting for work waits through either.
    const next = await nextTask(ctx, runId, role).catch((error: unknown): NextTask => {
      if (
        isRunRefusal(error) &&
        (error.code === 'stopping' || error.code === 'forced-stop' || error.code === 'version-mismatch')
      ) {
        return {
          ready: [],
          messages: [],
          why: error.message,
          paused: error.message,
          scratch: agentScratch(runPaths(ctx.root, runId), ctx.agent)
        };
      }

      throw error;
    });
    if (next.task || next.designReview || next.leadReview || next.finished || next.messages.length > 0) {
      return next;
    }

    // The agent waits, and the activity says for what — once for each reason: a wait run again after its timeout, for
    // the same reason, is the same wait (velada-now's log held 28 "waiting" and 10 "idle" for a handful of waits).
    const why = next.why ?? 'nothing is ready';
    if (saidWaiting !== why) {
      saidWaiting = why;
      const paths = runPaths(ctx.root, runId);
      const last = (await readRunLog(paths)).findLast(entry => entry.by === ctx.agent);
      if (last?.action !== 'waiting' || last.why !== why) {
        await logRun(ctx, paths, { action: 'waiting', why });
      }
    }

    // A lead that reviews handed nothing for a while: the queue is empty, and waiting on costs tokens — `lead` starts it
    // again when the reviews queue up.
    if (idleLead && Date.now() - started >= idleMs) {
      await logRun(ctx, runPaths(ctx.root, runId), {
        action: 'stops',
        why: `no review came for ${durationText(idleMs)}: lead starts it again when the reviews queue up`
      });

      return {
        ...next,
        finished: true,
        why: `no review came for ${durationText(idleMs)}: you can stop — lead starts you again when the reviews queue up`
      };
    }

    // Its wait's end is no state of its own: it is told to wait again, and stays waiting until it takes work or stops.
    if (Date.now() - started >= timeoutMs) {
      // Its own task in review comes back to it if it is sent back: an agent told only "nothing came" took the wait's
      // end for the run's, and stopped — and velada-now's t-case and t-boxer came back to nobody.
      const loaded = await loadRun(ctx, runId);
      const inReview = (await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task))))
        .filter(view => view.owner?.agent === ctx.agent && view.state.status === 'in-review')
        .map(view => view.task.id);

      return {
        ...next,
        timedOut: true,
        why: `waited ${durationText(timeoutMs)} and nothing came for you: ${next.why ?? 'nothing is ready'} — run it again to go on waiting${inReview.length > 0 ? `. Do not stop: ${inReview.join(', ')}, yours, ${inReview.length === 1 ? 'is' : 'are'} in review and come${inReview.length === 1 ? 's' : ''} back to you if sent back — you stop only when task next says you can` : ''}`
      };
    }

    await runChanged(runPaths(ctx.root, runId).dir, everyMs);
  }
};
