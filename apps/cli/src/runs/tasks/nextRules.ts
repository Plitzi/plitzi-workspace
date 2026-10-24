import fs from 'node:fs/promises';
import path from 'node:path';

import { hasDesignReview } from '../design';
import { createExclusive } from '../files';
import { coLeadsOf, isPrincipal, spareLead } from '../leads';
import { LEAD } from '../messages';
import { freeBaseAgents, runningAgents } from '../onDemand';
import { agentScratch } from '../paths';
import { PRESENCE_STALE_MS, presentAt } from '../presence';
import { loadRun, logRun, readRunLog } from '../run';
import { viewTask } from '../taskStore';
import { DEFAULT_SESSION, DESIGNER, FRESH_CONTEXT_AT, readTeam, startedAgents } from '../team';
import { isWorked } from '../worked';

import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';

/** What `task next` weighs beside the work itself: who of the team goes first, who is spare, and how a wait is said. */

/** Logs `joined` the first time an agent asks the run for work — kept as the scratch folder it is given. */
export const markJoined = async (ctx: RunContext, loaded: LoadedRun): Promise<void> => {
  // By a mark of its own, made once: the scratch folder an agent made itself first — for its crops — read as an arrival
  // already said (velada-polish: design-1 never "joined" the run).
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

/** What ends a piece of an agent's work, in the run's log: a task completed, a review decided. */
const PIECE_ENDS = new Set(['complete', 'review', 'design-review']);

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
): Promise<{ why: string } | undefined> => {
  if (isPrincipal(ctx.agent)) {
    return undefined;
  }

  const team = await readTeam(ctx.root).catch(() => undefined);
  const member = (team ? startedAgents(team) : []).find(each => each.agent === ctx.agent);
  // Only one the run starts again stops for it: an agent of the team, or a lead that reviews — another, with nobody to
  // start it, keeps its session.
  const mode = member ? (member.session ?? DEFAULT_SESSION) : coLeadsOf(loaded.record).includes(ctx.agent) ? DEFAULT_SESSION : 'keep';
  if (mode === 'keep') {
    return undefined;
  }

  const log = await readRunLog(loaded.paths);
  const began = log.findLastIndex(
    entry =>
      (entry.action === 'stops' && entry.by === ctx.agent) || (entry.action === 'launch' && entry.agent === ctx.agent)
  );
  const ended = log.slice(began + 1).findLast(entry => entry.by === ctx.agent && PIECE_ENDS.has(String(entry.action)));
  if (!ended) {
    return undefined;
  }

  const task = typeof ended.task === 'string' ? ended.task : undefined;
  if (inAPiece(ctx.agent, views)) {
    return undefined;
  }

  const own = views.filter(view => view.owner?.agent === ctx.agent && isWorked(view.state.status));
  if (
    ended.action === 'complete' &&
    own.some(view => view.task.id === task && view.state.status === 'changes-requested')
  ) {
    return undefined;
  }

  const piece =
    ended.action === 'complete'
      ? `${task ?? 'your task'} is complete`
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

    return (
      (state.status === 'in-review' && state.reviewer?.by === agent && state.reviewer.round === state.round) ||
      (state.design?.status === 'due' && state.design.by === agent)
    );
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
 * How many UI reviews are on their way past what the other designers running take: tasks at work whose UI a designer
 * will look at, beyond one each for the rest. What keeps a designer on demand from stopping only to be started again.
 */
export const uiReviewsComing = async (
  ctx: RunContext,
  loaded: LoadedRun,
  views: readonly TaskView[]
): Promise<number> => {
  if (loaded.record.designReview !== true) {
    return 0;
  }

  const team = await readTeam(ctx.root).catch(() => undefined);
  const running = runningAgents(await readRunLog(loaded.paths));
  const others = (team ? startedAgents(team) : []).filter(
    each => each.agent !== ctx.agent && each.roles.includes(DESIGNER) && running.has(each.agent)
  ).length;
  const coming = views.filter(
    view =>
      view.owner !== undefined &&
      isWorked(view.state.status) &&
      hasDesignReview(view.task, [...view.task.files, ...(view.state.changed ?? [])])
  ).length;

  return Math.max(0, coming - others);
};

/** A wait's reason, without what it names: `nothing is ready` of `nothing is ready: t-home in-progress (dev-1), …`. */
export const reasonOf = (why: string): string => why.split(/[:—]/)[0]?.trim() ?? why;

/** Why a lead that reviews is spare now, if it is: what is left — none of it in review — is for the other leads. */
export const spareNow = async (ctx: RunContext, runId: string): Promise<string | undefined> => {
  const loaded = await loadRun(ctx, runId);
  const views = await Promise.all(loaded.tasks.map(task => viewTask(loaded.paths, task)));
  const open = views.filter(view => view.state.status !== 'done');
  const others = [LEAD, ...coLeadsOf(loaded.record)].filter(lead => lead !== ctx.agent).length;
  if (open.some(view => view.state.status === 'in-review') || !spareLead(open.length, others)) {
    return undefined;
  }

  return `${String(open.length)} task${open.length === 1 ? '' : 's'} left (${open.map(view => view.task.id).join(', ') || 'none'}) for ${String(others)} other lead${others === 1 ? '' : 's'}: no review is yours to wait for`;
};

/** What a sent-back task's last review asked, by whom: handed with it, to its agent or to the one taking it over. */
export const lastAsked = (view: TaskView): string[] =>
  view.state.notes
    .filter(note => note.text.startsWith(`Review ${String(view.state.round)}: `))
    .map(note => `${note.by}: ${note.text.slice(`Review ${String(view.state.round)}: `.length)}`);

/**
 * What a task's reviews asked, as the next review is handed it: the last review's notes whole, the earlier ones counted —
 * each round's hand-off repeated every review before it whole (velada-now's t-boxer, round 4).
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
 * team started it with, never every role — a developer offered a UI review was refused at its verdict (lx-copy: dev-1
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
