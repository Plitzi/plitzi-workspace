import fs from 'node:fs/promises';

import { durationText, FOLLOW_MS } from '../../options';
import { handOver } from '../handOver';
import { assertRoles } from '../identity';
import { isPrincipal, LEAD_ROLE } from '../leads';
import { agentAddress, unreadFor } from '../messages';
import { ON_DEMAND_IDLE_MS } from '../onDemand';
import { agentScratch, runPaths } from '../paths';
import { readyTasks } from '../plan';
import { markPresent } from '../presence';
import { isRunRefusal } from '../refusal';
import { reviewFor, reviewRolesOf, reviewSteps, reviewTeamOf } from '../reviews';
import { assertStatus, loadRun, logRun, readRunLog } from '../run';
import { runChanged } from '../runChanged';
import { tellLeftInTmp } from '../strays';
import { isDisconnected, viewTask } from '../taskStore';
import { qualityRank, readTeam, startedAgents } from '../team';
import { isWorked } from '../worked';
import { findTask } from './common';
import { leadNext } from './leadNext';
import { allLocks } from './locks';
import { askedRoles, baseFirst, freshStart, lastAsked, reasonOf, markJoined, reviewsComing } from './nextRules';
import { reviewOffer, takeOfferedStep } from './reviewOffer';
import { spareTests } from './spareTests';
import { writesTests } from '../tests';
import { takeTask } from './take';
import { roleOf } from '../spike';

import type { Message } from '../messages';
import type { RunTask, TaskStatus } from '../model';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';
import type { ReviewOffer } from './reviewOffer';
import type { TakenTask } from './take';

/**
 * `plitzi task next`: what an agent between tasks is handed — its own task back, a designer's review, the next ready
 * task — and waiting for one, taking it in the same breath (`task next` does both unless told).
 */

export interface NextTask {
  task?: RunTask;
  /** The caller's own folder in the run, for what it writes beside its work — made, so it is there to write in. */
  scratch: string;
  /**
   * The task is one the caller already holds and can go on with — a block lifted, changes requested: no take, its token
   * is still good.
   */
  yours?: 'in-progress' | 'changes-requested';
  /** Handed back with changes requested: what its last review asked, by whom. */
  asked?: string[];
  /** In progress and the caller's: lifted from a block by the lead, or held all along — the one to go on with first. */
  back?: 'unblocked' | 'held';
  /** One the caller holds: where its copy is — the only place its work is written. */
  work?: string;
  /** Handed to this agent by the lead when it took it back from another (`task reassign --to`), and why. */
  handedBy?: { by: string; reason?: string };
  /**
   * A review, before any task of its own: the step of a card's review this agent says (`reviews.ts`) — a designer's, a
   * tester's, a developer's one nobody of its role may take, the lead's — the card as it went to review.
   */
  review?: ReviewOffer;
  /**
   * The lead's to find out, nobody else at it: an agent's question (`blocking`) — a task at work blocked on it, whose block
   * its answer lifts (`task unblock --answer`) — or, with no scout in the team, a research card (`task complete --found`).
   */
  spike?: {
    task: RunTask;
    question: string;
    findings: number;
    blocking?: true;
    /** The site the run copies, to compare with — none, and its brief says nothing of an original. */
    reference?: string;
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
  /** Waiting gave up after its timeout, with nothing for the caller. */
  timedOut?: true;
}

/** `plitzi task next`: the ready task to take — the most urgent (its priority, or the highest of what waits on it), then the longest chain still to do. */
export const nextTask = async (ctx: RunContext, runId: string, role?: string): Promise<NextTask> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open'], 'start a task');
  // An agent's first ask is its arrival: the run's activity says who worked it, from when, at which level.
  await markJoined(ctx, loaded);
  // Told before the messages are read, so an agent that left something in the project's tmp/ hears it in this answer.
  await tellLeftInTmp(ctx, loaded);
  const scratch = agentScratch(loaded.paths, ctx.agent);
  await fs.mkdir(scratch, { recursive: true });
  await markPresent(loaded.paths, ctx.agent, ctx.now());

  const next = await nextOf(ctx, loaded, role);
  // Nothing left for it, ever: the activity says the agent stops, and why — never a silence read as a hang. The lead
  // goes on to close the run: it never stops.
  if (next.finished && !isPrincipal(ctx.agent)) {
    await logRun(ctx, loaded.paths, { action: 'stops', why: next.why ?? 'nothing is left for it' });
  }

  return { ...next, scratch };
};

const nextOf = async (ctx: RunContext, loaded: LoadedRun, role?: string): Promise<Omit<NextTask, 'scratch'>> => {
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const states = new Map(views.map(view => [view.task.id, view.state]));
  const held = new Set(views.filter(view => view.owner).map(view => view.task.id));
  const roles = await askedRoles(ctx, role);
  await assertRoles(ctx.root, ctx.agent, roles ?? []);
  const spare = await spareTests(loaded, views, ctx.agent);
  // Of its roles — and never the tests of a task it worked: another writes them, from what was asked.
  const forRole = (task: RunTask): boolean =>
    writesTests(task, ctx.agent, views) && (roles === undefined || roles.includes(roleOf(task)) || spare(task));
  // What the lead said to this agent by name — between tasks, there is nowhere else for it to arrive.
  const messages = await unreadFor(loaded, agentAddress(ctx.agent), true);
  const mine = views.filter(view => view.owner?.agent === ctx.agent && isWorked(view.state.status));
  // Between two pieces of work, before its own is handed back: the next session takes it up, with a fresh context.
  const fresh = await freshStart(ctx, loaded, views);
  if (fresh !== undefined) {
    return { why: fresh.why, ready: [], messages, finished: true };
  }

  // What the caller holds and can go on with comes before anything new: an agent between tasks waits with `next`, and
  // this is how it hears that its blocked task was unblocked, or that its review asked for changes.
  for (const view of mine) {
    const { status } = view.state;
    if (isWorked(status)) {
      // …with what was said to that task meanwhile — an amendment, a review's words — which it reads nowhere else first.
      const toTask = await handOver(ctx, loaded, view.task.id, ctx.agent);

      // Sent back: what its last review asked, said where it is handed back — not only in the brief.
      const asked = lastAsked(view);
      // Why it comes back, as it is: lifted by the lead, or never let go — one held while another was worked was said
      // "unblocked" right after a `complete` told it to take no other step.
      const back =
        status === 'changes-requested'
          ? undefined
          : view.state.notes.at(-1)?.kind === 'unblocked'
            ? ('unblocked' as const)
            : ('held' as const);

      return {
        task: view.task,
        yours: status,
        ...(back ? { back } : {}),
        work: view.paths.work,
        ...(status === 'changes-requested' && asked.length > 0 ? { asked } : {}),
        ready: [],
        messages: [...messages, ...toTask].sort((x, y) => x.at.localeCompare(y.at) || x.id.localeCompare(y.id))
      };
    }
  }

  // The lead's queue: what is escalated to it, what a scout proposes, the reviews and spikes the team has nobody for.
  if (roles?.includes(LEAD_ROLE) === true) {
    return leadNext(ctx, loaded, views, messages);
  }

  // A review holds back a card already done: the step of a review this agent says comes before anything new — a
  // designer's, a tester's, a developer's of one nobody of its role may say.
  const reviewTeam = await reviewTeamOf(ctx.root);
  const review = reviewFor(views, ctx.agent, reviewTeam, ctx.now().getTime());
  if (review) {
    return { review: await reviewOffer(loaded, review, reviewTeam, ctx.agent), ready: [], messages };
  }

  // The roles it reviews as — a designer, a tester: a card whose review names one is coming its way.
  const reviewsAs = reviewRolesOf(reviewTeam, ctx.agent);
  const comesToIt = (view: TaskView): boolean =>
    reviewSteps(view.task, reviewTeam).some(each => reviewsAs.includes(each));

  // Started at a level, an agent is handed tasks of it or below: a stronger model is for the tasks that ask for one.
  const fits = (task: RunTask): boolean =>
    ctx.quality === undefined || qualityRank(task.quality ?? 'standard') <= qualityRank(ctx.quality);
  const above = readyTasks(loaded.tasks, states, held).filter(task => forRole(task) && !fits(task));
  // A task whose file another task holds is not offered: taking it would be refused (`claimed`), and an agent refused
  // three times stops — a run's integration of home/index.ts, while the task holding it was sent back.
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
  // A task the lead handed to one agent is that agent's alone, and comes first to it.
  const handedTo = (task: RunTask): string | undefined => states.get(task.id)?.handTo?.agent;
  const fitting = readyTasks(loaded.tasks, states, held)
    .filter(task => forRole(task) && fits(task) && (handedTo(task) === undefined || handedTo(task) === ctx.agent))
    // What was handed to it first, then its own role's before another role's card it may take as a spare.
    .sort(
      (a, b) =>
        Number(handedTo(b) === ctx.agent) - Number(handedTo(a) === ctx.agent) ||
        Number(spare(a) && !(roles?.includes(roleOf(a)) ?? true)) -
          Number(spare(b) && !(roles?.includes(roleOf(b)) ?? true))
    );
  const ready = fitting.filter(task => holderOfFile(task) === undefined);
  const handed = ready.find(task => handedTo(task) === ctx.agent);
  if (handed) {
    const to = states.get(handed.id)?.handTo;

    return {
      task: handed,
      ready: ready.map(task => task.id),
      messages,
      ...(to ? { handedBy: { by: to.by, ...(to.reason ? { reason: to.reason } : {}) } } : {})
    };
  }

  const waitingForFile = fitting.flatMap(task => {
    const holder = holderOfFile(task);

    return holder ? [{ waiting: task.id, file: holder.file, holder: holder.task }] : [];
  });
  // A task the limit would not let this agent take is not offered: it is said, and waiting waits for a place.
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

  // A reviewer takes no task of its own while others are at work on cards it will review: their reviews come soon, and
  // one at a task of its own leaves every one of them waiting (a run's motion stage: the designer at a fight's page
  // for twenty minutes, nine UI reviews the lead's). Nothing coming its way, it works as any developer.
  const reviewsComing = views.filter(
    view => view.owner !== undefined && view.owner.agent !== ctx.agent && isWorked(view.state.status) && comesToIt(view)
  );
  // …unless a ready task is one no developer takes — its own role's — or critical: it waits for nobody else, and while
  // reviews keep coming it would wait for ever (t-shell, critical and the only designer's, sat ready seven
  // minutes until the lead messaged design-1, four developers keeping a review always "coming").
  const ownToTake = ready.filter(
    task => (task.role !== undefined && reviewsAs.includes(task.role)) || task.priority === 'critical'
  );
  if (reviewsComing.length > 0 && ownToTake.length > 0) {
    // That one, not any task: what a developer would take still waits for the developers.
    return { task: ownToTake[0], ready: ready.map(task => task.id), messages };
  }

  if (ready.length > 0 && reviewsComing.length > 0) {
    return {
      why: `reviews are coming — ${reviewsComing.map(view => `${view.task.id} (${view.owner?.agent ?? ''})`).join(', ')} at work: a reviewer waits for them rather than taking a task of its own (plitzi task next waits), and takes one once none is coming`,
      ready: ready.map(task => task.id),
      messages
    };
  }

  // On demand, the base of its roles goes first: what ready tasks its free agents take are not offered here.
  const base = ready.length > 0 ? await baseFirst(ctx, loaded, views, roles) : [];
  if (ready.length > 0 && base.length >= ready.length) {
    return {
      why: `${ready.map(task => task.id).join(', ')} ready, for ${base.join(', ')}, free and of the team's base: you are on demand — you take what they cannot (plitzi task next waits for it)`,
      ready: ready.map(task => task.id),
      messages
    };
  }

  if (ready.length > 0) {
    return { task: ready[base.length], ready: ready.map(task => task.id), messages };
  }

  if (ready.length === 0 && waitingForFile.length > 0) {
    return {
      why: `ready, but a file of each is another task's until that one is approved: ${waitingForFile.map(each => `${each.waiting} (${each.file}, held by ${each.holder})`).join(', ')} — plitzi task next waits for it`,
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
  // A reviewer is not done while a card its review names is still to be done.
  const toReview = views.filter(view => view.state.status !== 'done' && comesToIt(view));
  // The roles it asked as — the team's for it when it named none: a run's design-1 read "nothing ready for a undefined".
  const asRole = roles?.join(' or ') ?? 'role';
  const why =
    roles !== undefined && coming.length === 0 && toReview.length > 0
      ? `no task is left for a ${asRole} to work: ${toReview.map(view => `${view.task.id} (${view.state.status})`).join(', ')} ${toReview.length === 1 ? 'is' : 'are'} yours to review once in review — plitzi task next waits for it`
      : others.length > 0
        ? `nothing ready for a ${asRole}: ready for others — ${others.map(task => `${task.id} (${writesTests(task, ctx.agent, views) ? roleOf(task) : 'the tests of what you worked: another writes them'})`).join(', ')}`
        : roles !== undefined && coming.length === 0
          ? `no task is left for a ${asRole}: every one is done`
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
                      view.owner?.agent === ctx.agent && view.state.status === 'in-review'
                        ? ' (yours, in review: if it is sent back, it comes to you here)'
                        : view.owner
                          ? ` (${view.owner.agent}${isDisconnected(view.task, view.signalAt, ctx.now()) ? ', no signal — the lead may reassign it' : ''})`
                          : ''
                    }`
                )
                .join(', ')}`;

  // Never while a task of its own is in review: one sent back comes back to it, and nobody else redoes it.
  const ownInReview = views.some(view => view.owner?.agent === ctx.agent && view.state.status === 'in-review');
  const nothingLeft = open.length === 0 || (roles !== undefined && coming.length === 0 && toReview.length === 0);
  // One of the team's base stays while the run is open, idle when nothing is left for it: the lead may stack another
  // stage, and a run's designers and tester, stopped once every task was done, were stopped when one came.
  const team = await readTeam(ctx.root).catch(() => undefined);
  const ofBase = (team ? startedAgents(team) : []).some(each => each.agent === ctx.agent && each.onDemand !== true);
  const finished = !ownInReview && !ofBase && nothingLeft;
  // An agent done with the run hears how its own work ended: its copies are gone, and the run may end before it asks.
  const worked = views
    .filter(view => view.state.notes.some(note => note.by === ctx.agent && note.kind === 'taken'))
    .map(view => {
      // Reverted and redone, or cut and taken over: whose work it ends as is the last taker's, said so.
      const last = view.state.notes.filter(note => note.kind === 'taken').at(-1)?.by;

      return {
        task: view.task.id,
        status: view.state.status,
        ...(last !== undefined && last !== ctx.agent ? { finishedBy: last } : {})
      };
    });

  return {
    // Finished, it says so: what is ready for other roles is no reason to wait.
    // Every answer that ends an agent's part says the skills' words (a run's agents waited for them).
    why:
      // Every task approved: what is left is the finish — a run's design-1 waited 4.5 h told only to wait.
      ofBase && open.length === 0 && !ownInReview
        ? "every task of the run is approved: it waits for its finish — the lead's summary, then a person's apply — and nothing comes to you unless the lead stacks a stage — you are of the team's base: plitzi task next waits for it"
        : ofBase && nothingLeft && !ownInReview
          ? `${why} — you are of the team's base: plitzi task next waits for what comes — a stage the lead stacks, a task sent back — until the run finishes`
          : finished && roles !== undefined && open.length > 0
            ? `${loaded.tasks.some(forRole) ? `no task is left for a ${roles.join(' or ')}: every one is done` : `no task in this run is a ${roles.join(' or ')}'s`} — what is left is for others (${others.map(task => task.id).join(', ') || 'in their hands'}). You can stop`
            : finished && roles !== undefined
              ? `${why} — the lead's to finish. You can stop`
              : finished && !isPrincipal(ctx.agent)
                ? // Asked with no role (a run's dev-1 after its first task): the same words, never the lead's finish to run.
                  "every task is done — the run's finish is the lead's. You can stop"
                : why,
    ready: [],
    messages,
    ...(finished ? { finished: true } : {}),
    ...(nothingLeft && !ownInReview ? { worked } : {})
  };
};

/**
 * `plitzi task next`: waits until a task is ready for the role — another task approved, a block lifted — the
 * lead says something to the agent, or none ever will be (every task of it done), or `timeoutMs` passes. What an agent between tasks runs, rather than
 * stopping because nothing is ready this very moment.
 */
/**
 * `plitzi task next`: the next task, taken in the same breath. Another agent taking the one offered meanwhile is
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
    // A review is taken as its own — another that took it first is no refusal: the next is offered.
    if (next.review) {
      const offered = next.review.task.id;
      const loaded = await loadRun(ctx, runId);
      if (tried.has(offered)) {
        return { next };
      }

      if (await takeOfferedStep(ctx, loaded, await viewTask(loaded.paths, findTask(loaded, offered)), next.review)) {
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
  { timeoutMs = FOLLOW_MS, everyMs = 10_000, onDemandIdleMs = ON_DEMAND_IDLE_MS } = {}
): Promise<NextTask> => {
  const started = Date.now();
  let saidWaiting: string | undefined;
  // An agent on demand (past its group's `min`) stops once nothing is left for it: the lead starts it again.
  const team = await readTeam(ctx.root).catch(() => undefined);
  const onDemand = team ? startedAgents(team).some(each => each.agent === ctx.agent && each.onDemand) : false;
  for (;;) {
    // A run stopped — gently, by its brake, or by a person at once — goes on once resumed, and one whose Plitzi was
    // upgraded once a person re-pins it: an agent waiting for work waits through either.
    const next = await nextTask(ctx, runId, role).catch(async (error: unknown): Promise<NextTask> => {
      if (
        isRunRefusal(error) &&
        (error.code === 'stopping' || error.code === 'forced-stop' || error.code === 'version-mismatch')
      ) {
        // Waiting for the run to go on is being there: unmarked, the monitor showed design-1 gone while the brake held
        // the run — `nextTask` refuses before it marks.
        await markPresent(runPaths(ctx.root, runId), ctx.agent, ctx.now());

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
    if (next.task || next.review || next.spike || next.finished || next.messages.length > 0) {
      return next;
    }

    // The agent waits, and the activity says for what — once for each reason: a wait run again after its timeout, for
    // the same reason, is the same wait (a run's log held 28 "waiting" and 10 "idle" for a handful of waits).
    // By its reason, not its words: the tasks a reason names change as the run goes, and each change was a line
    // (118 "waiting" in a log of 505, for a handful of waits).
    const why = next.why ?? 'nothing is ready';
    const reason = reasonOf(why);
    if (saidWaiting !== reason) {
      saidWaiting = reason;
      const paths = runPaths(ctx.root, runId);
      const last = (await readRunLog(paths)).findLast(entry => entry.by === ctx.agent);
      if (last?.action !== 'waiting' || reasonOf(String(last.why)) !== reason) {
        await logRun(ctx, paths, { action: 'waiting', why });
      }
    }

    // Its wait's end is no state of its own: it is told to wait again, and stays waiting until it takes work or stops.
    if (onDemand && Date.now() - started >= onDemandIdleMs) {
      // Not while a task of its own may come back to it: one in review, or blocked — nor, a reviewer, while more
      // reviews of its role are coming than the others running (design-2 stopped at 20:18 with four on their way,
      // and was started again for them).
      // Read only, so a wait through a version change is told it ended, not refused.
      const loaded = await loadRun(ctx, runId, { anyVersion: true });
      const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
      const own = views.filter(view => view.owner?.agent === ctx.agent && view.state.status !== 'done');
      const coming = await reviewsComing(ctx, loaded, views);
      if (own.length === 0 && coming === 0) {
        const why = `nothing came for you in ${durationText(onDemandIdleMs)}: you are on demand — the lead starts you again when work waits for you`;
        await logRun(ctx, runPaths(ctx.root, runId), { action: 'stops', why });

        return { ...next, finished: true, why: `${why}. You can stop` };
      }
    }

    if (Date.now() - started >= timeoutMs) {
      // Its own task in review comes back to it if it is sent back: an agent told only "nothing came" took the wait's
      // end for the run's, and stopped — and a run's t-case and t-boxer came back to nobody.
      const loaded = await loadRun(ctx, runId, { anyVersion: true });
      const inReview = (await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task))))
        .filter(view => view.owner?.agent === ctx.agent && view.state.status === 'in-review')
        .map(view => view.task.id);

      return {
        ...next,
        timedOut: true,
        // One rule, always said: a wait that ends is never the work's end — "run it again" alone, with nothing of the
        // agent's in review, read as leave to stop.
        why: `waited ${durationText(timeoutMs)}, nothing came for you yet (${next.why ?? 'nothing is ready'}). Your wait ended, not your work: run the same command again — you stop only when task next says "You can stop"${inReview.length > 0 ? `; ${inReview.join(', ')}, yours, ${inReview.length === 1 ? 'is' : 'are'} in review, and come${inReview.length === 1 ? 's' : ''} back to you if sent back` : ''}`
      };
    }

    await runChanged(runPaths(ctx.root, runId).dir, everyMs);
  }
};
