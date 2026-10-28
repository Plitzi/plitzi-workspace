import fs from 'node:fs/promises';
import path from 'node:path';

import { reviewRolesOf, reviewSteps, reviewTeamOf } from './reviews';
import { isPrincipal } from '../agents/leads';
import { freeBaseAgents, runningAgents } from '../agents/onDemand';
import { PRESENCE_STALE_MS, presentAt } from '../agents/presence';
import { DEFAULT_SESSION, FRESH_CONTEXT_AT, readTeam, startedAgents } from '../agents/team';
import { isWorked } from '../agents/worked';
import { createExclusive } from '../core/files';
import { agentScratch } from '../core/paths';
import { viewTask } from '../core/taskStore';
import { loadRun, logRun, readRunLog } from '../run';

import type { TaskView } from '../core/taskStore';
import type { LoadedRun, RunContext } from '../run';

/** What `task next` weighs beside the work itself: who of the team goes first, who is spare, and how a wait is said. */

/** Logs `joined` the first time an agent asks the run for work — kept as the scratch folder it is given. */
export const markJoined = async (ctx: RunContext, loaded: LoadedRun): Promise<void> => {
  // By a mark of its own, made once: the scratch folder an agent made itself first — for its crops — read as an arrival
  // already said (design-1 never "joined" the run).
  const mark = path.join(agentScratch(loaded.paths, ctx.agent), '.joined');
  await fs.mkdir(path.dirname(mark), { recursive: true });
  if (!(await createExclusive(mark, ctx.now().toISOString()))) {
    return;
  }

  await logRun(ctx, loaded.paths, {
    action: 'joined',
    ...(ctx.quality === undefined ? {} : { quality: ctx.quality })
  });
};

/**
 * What ends a piece of an agent's work, in the run's log: a task completed, a review decided or escalated, what a spike
 * found handed to the lead.
 */
const PIECE_ENDS = new Set(['complete', 'review', 'review-escalated']);

/**
 * Whether the caller, between two pieces of work, stops to be started again with a fresh context (`SessionMode`), and
 * why — or nothing. Its session is what it did since it was last launched or stopped; once a piece of it ended, `task`
 * (the default) stops it, and `context` once its harness's context passes the team's `freshContextAt`. The piece it just
 * ended, sent back already, is the one exception: its context is what that round needs. The lead that plans never
 * stops for it, nor an agent outside the team: nobody would start it again.
 */
export const freshStart = async (
  ctx: RunContext,
  loaded: LoadedRun,
  views: readonly TaskView[]
): Promise<{ why: string; already?: true } | undefined> => {
  if (isPrincipal(ctx.agent)) {
    return undefined;
  }

  const team = await readTeam(ctx.root).catch(() => undefined);
  const member = (team ? startedAgents(team) : []).find(each => each.agent === ctx.agent);
  // Only one the run starts again stops for it: an agent of the team — another, with nobody to start it, keeps its session.
  const mode = member ? (member.session ?? DEFAULT_SESSION) : 'keep';
  if (mode === 'keep') {
    return undefined;
  }

  const log = await readRunLog(loaded.paths);
  const began = log.findLastIndex(
    entry =>
      (entry.action === 'stops' && entry.by === ctx.agent) || (entry.action === 'launch' && entry.agent === ctx.agent)
  );
  // Told to stop by the answer that ended its piece (`stopAfterPiece`): the same session asking again is told again —
  // a new piece in it would be worked in the context the stop was for. Another session, or one it cannot tell (a
  // harness that says none), is a start: what it asks is answered.
  const last = began === -1 ? undefined : log.at(began);
  const session = ctx.session?.();
  if (
    last?.action === 'stops' &&
    last.fresh === true &&
    typeof last.why === 'string' &&
    session !== undefined &&
    last.session === session
  ) {
    return { why: last.why, already: true };
  }
  const ended = log.slice(began + 1).findLast(entry => entry.by === ctx.agent && PIECE_ENDS.has(String(entry.action)));
  if (!ended) {
    return undefined;
  }

  const task = typeof ended.task === 'string' ? ended.task : undefined;
  if (inAPiece(ctx.agent, views)) {
    return undefined;
  }

  const own = views.filter(view => view.owner?.agent === ctx.agent && isWorked(view.state.status));
  // A card sent back to its agent — research to its scout too — is a piece again, worked in that context.
  if (
    ended.action === 'complete' &&
    own.some(view => view.task.id === task && view.state.status === 'changes-requested')
  ) {
    return undefined;
  }

  const piece =
    ended.action === 'complete'
      ? Array.isArray(ended.proposed)
        ? `what you found on ${task ?? 'a research card'} is with the lead`
        : `${task ?? 'your task'} is complete`
      : ended.action === 'review-escalated'
        ? `your review of ${task ?? 'a task'} is with the lead`
        : `your review of ${task ?? 'a task'} is decided`;
  const next =
    own.length > 0
      ? `${own.map(view => view.task.id).join(', ')}, which you hold, and what comes next`
      : 'what comes next';
  if (mode === 'task') {
    return {
      why: `${piece}: you are started again with a fresh context after each task or review (your team's session: task) — for ${next}. You can stop`
    };
  }

  const context = await ctx.context?.();
  const limit = team?.options?.freshContextAt ?? FRESH_CONTEXT_AT;
  if (context === undefined || context <= limit) {
    return undefined;
  }

  return {
    why: `${piece}, and your context is ${thousands(context)} tokens, past the team's ${thousands(limit)} (freshContextAt): every turn reads it all again — you are started again with a fresh one for ${next}. You can stop`
  };
};

/** The session a stop is said to, kept with it: the one that asks again is told again. */
export const stoppedIn = (ctx: Pick<RunContext, 'session'>): { session?: string } => {
  const session = ctx.session?.();

  return session === undefined ? {} : { session };
};

/**
 * Whether the caller, its piece of work just ended — a task completed, a review decided, what a spike found handed on —
 * stops now (`freshStart`), said with the answer that ended it and kept as `task next` keeps it: agents called `task
 * next` only to hear "you can stop", a turn a piece — read again whole, every one.
 */
export const stopAfterPiece = async (ctx: RunContext, runId: string): Promise<string | undefined> => {
  const loaded = await loadRun(ctx, runId);
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const fresh = await freshStart(ctx, loaded, views);
  if (fresh === undefined) {
    return undefined;
  }

  if (fresh.already !== true) {
    await logRun(ctx, loaded.paths, { action: 'stops', why: fresh.why, fresh: true, ...stoppedIn(ctx) });
  }

  return fresh.why;
};

/**
 * Whether `agent` is in a piece of work, by the tasks' state — never by the log alone: a `task next` comes from an agent
 * in a task too, its task blocked or given back to it, or one it took since its last piece ended. In one: a task it
 * holds at work, waiting or blocked; one sent back it took up again since its review; a review it took and has not
 * decided — its UI's or the code's. Stopped there, what it knows of it and has not written would be lost.
 */
export const inAPiece = (agent: string, views: readonly TaskView[]): boolean =>
  views.some(view => {
    const { state } = view;
    if (view.owner?.agent === agent) {
      if (state.status === 'in-progress' || state.status === 'waiting' || state.status === 'blocked') {
        return true;
      }

      const sentBackAt = view.review === undefined ? Number.NaN : Date.parse(view.review.at);
      if (state.status === 'changes-requested' && (view.workedAt ?? 0) > sentBackAt) {
        return true;
      }
    }

    return state.status === 'in-review' && state.review?.by === agent;
  });

const thousands = (tokens: number): string => `${String(Math.round(tokens / 1000))}k`;

/** For an agent on demand: the team's base agents of its roles, there and free — ready work is theirs first. */
export const baseFirst = async (
  ctx: RunContext,
  loaded: LoadedRun,
  views: readonly TaskView[],
  roles: readonly string[] | undefined
): Promise<string[]> => {
  const team = await readTeam(ctx.root).catch(() => undefined);
  const started = team ? startedAgents(team) : [];
  const me = started.find(each => each.agent === ctx.agent);
  if (me?.onDemand !== true) {
    return [];
  }

  const now = ctx.now().getTime();
  const present = new Set<string>();
  for (const each of started) {
    const seen = await presentAt(loaded.paths, each.agent);
    if (seen !== undefined && now - seen <= PRESENCE_STALE_MS) {
      present.add(each.agent);
    }
  }

  return freeBaseAgents(
    views,
    started,
    runningAgents(await readRunLog(loaded.paths)),
    present,
    ctx.agent,
    roles ?? me.roles
  );
};

/**
 * How many reviews of the roles `ctx.agent` reviews as are on their way past what the others of those roles running
 * take: cards at work whose review names one of them, beyond one each for the rest. What keeps a reviewer on demand
 * from stopping only to be started again (design-2 stopped with four UI reviews on their way, and was started again).
 */
export const reviewsComing = async (
  ctx: RunContext,
  loaded: LoadedRun,
  views: readonly TaskView[]
): Promise<number> => {
  const team = await reviewTeamOf(ctx.root);
  const roles = reviewRolesOf(team, ctx.agent);
  if (roles.length === 0) {
    return 0;
  }

  const running = runningAgents(await readRunLog(loaded.paths));
  const others = new Set(
    roles.flatMap(role => (team.byRole[role] ?? []).filter(agent => agent !== ctx.agent && running.has(agent)))
  ).size;
  const coming = views.filter(
    view =>
      view.owner !== undefined &&
      isWorked(view.state.status) &&
      reviewSteps(view.task, team).some(role => roles.includes(role))
  ).length;

  return Math.max(0, coming - others);
};

/** A wait's reason, without what it names: `nothing is ready` of `nothing is ready: t-home in-progress (dev-1), …`. */
export const reasonOf = (why: string): string => why.split(/[:—]/)[0]?.trim() ?? why;

/** What a sent-back task's last review asked, by whom: handed with it, to its agent or to the one taking it over. */
export const lastAsked = (view: TaskView): string[] =>
  view.state.notes
    .filter(note => note.kind === 'review' && note.round === view.state.round)
    .map(note => `${note.by}: ${note.text.slice(`Review ${String(view.state.round)}: `.length)}`);

/**
 * What a task's reviews asked, as the next review is handed it: the last review's notes whole, the earlier ones counted —
 * each round's hand-off repeated every review before it whole (a run's t-boxer, round 4).
 */
export const askedOf = (notes: readonly { by: string; text: string }[]): { asked: string[]; earlier: number } => {
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

/**
 * The roles an agent asks for work as: one role, or several it takes — `developer,reviewer`. None said: the roles the
 * team started it with, never every role — a developer offered a UI review was refused at its verdict (dev-1
 * and dev-2, each once).
 */
export const askedRoles = async (ctx: RunContext, role: string | undefined): Promise<string[] | undefined> => {
  const said = role
    ?.split(',')
    .map(each => each.trim())
    .filter(Boolean);
  if (said !== undefined) {
    return said;
  }

  const team = await readTeam(ctx.root).catch(() => undefined);

  return team ? startedAgents(team).find(each => each.agent === ctx.agent)?.roles : undefined;
};
