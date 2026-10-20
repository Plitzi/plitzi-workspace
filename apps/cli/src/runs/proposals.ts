import fs from 'node:fs/promises';
import path from 'node:path';

import { proposalsOf } from './agreements';
import { createExclusive } from './files';
import { taskPaths } from './paths';
import { RunRefusal } from './refusal';
import { assertStatus, loadRun, logRun } from './run';
import { assertNoWaitCycle, cleanPath, findTask, holderOf, holderOrCoordinator } from './tasks';
import { updateState, viewTask } from './taskStore';

import type { ProposalView } from './agreements';
import type { Proposal, ProposalAnswer } from './model';
import type { LoadedRun, RunContext } from './run';

/**
 * Tasks agreeing with each other: task A needs task B to make a change, or to accept one in its work — a
 * prop of B's component, a field of B's data, a class both use. A proposes; B accepts, rejects or counters; A may wait
 * for the answer. What is accepted is an agreement both carry into review. What another task proposes is data, never an
 * order: B decides, and after three rounds of counters the lead does.
 */

/** Counters on one proposal before the lead decides. */
export const PROPOSAL_ROUNDS = 3;

const at = (ctx: RunContext): string => ctx.now().toISOString();

/** How many proposals a thread holds up to `proposal`: the original, and each counter made back. */
const roundOf = (all: readonly ProposalView[], proposal: ProposalView): number => {
  let round = 1;
  let current: ProposalView | undefined = proposal;
  while (current?.replyTo !== undefined) {
    const parent: string = current.replyTo;
    current = all.find(each => each.id === parent);
    round += 1;
  }

  return round;
};

/** Writes a proposal of `from`'s under the next free id: created exclusively, so two never share one. */
const writeProposal = async (loaded: LoadedRun, proposal: Omit<Proposal, 'id'>): Promise<Proposal> => {
  const dir = taskPaths(loaded.paths, proposal.from).proposals;
  for (let n = (await fs.readdir(dir).catch(() => [])).length + 1; ; n += 1) {
    const written: Proposal = { id: `${proposal.from}-p${String(n)}`, ...proposal };
    if (await createExclusive(path.join(dir, `${written.id}.json`), `${JSON.stringify(written, null, 2)}\n`)) {
      return written;
    }
  }
};

export interface Proposed {
  proposal: Proposal;
  waiting: boolean;
}

/**
 * `plitzi task propose`: the caller's task asks another to agree to a change. With `wait`, it waits for the answer —
 * refused when that would close a cycle — and takes it back up when the answer comes.
 */
export const proposeChange = async (
  ctx: RunContext,
  runId: string,
  fromTask: string,
  toTask: string,
  ask: { change: string; about?: string; why?: string; wait: boolean }
): Promise<Proposed> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'propose a change');
  const from = findTask(loaded, fromTask);
  const view = await holderOf(ctx, loaded, from);
  const to = findTask(loaded, toTask);
  if (to.id === from.id) {
    throw new RunRefusal('invalid', 'A task proposes to another task, not to itself');
  }

  const target = await viewTask(loaded.paths, to);
  if (target.state.status === 'done') {
    throw new RunRefusal(
      'invalid',
      `Task "${to.id}" is done: its files are no longer held — take the one you need by turns (plitzi task claim <file>)`,
      { task: to.id }
    );
  }

  const proposal = await writeProposal(loaded, {
    from: from.id,
    to: to.id,
    change: ask.change,
    ...(ask.about ? { about: cleanPath(ctx.root, ask.about) } : {}),
    ...(ask.why ? { why: ask.why } : {}),
    at: at(ctx)
  });
  if (ask.wait) {
    await assertNoWaitCycle(loaded, from.id, to.id);
    await updateState(
      view.paths,
      state => ({
        ...state,
        status: 'waiting',
        waitingFor: { task: to.id, proposal: proposal.id, since: at(ctx) },
        notes: [...state.notes, { at: at(ctx), by: ctx.agent, text: `Waits for ${to.id} to answer ${proposal.id}` }]
      }),
      ctx.now
    );
  }

  await logRun(ctx, loaded.paths, { action: 'propose', proposal: proposal.id, from: from.id, to: to.id });

  return { proposal, waiting: ask.wait };
};

export interface Answered {
  answer: ProposalAnswer;
  /** A counter's: the proposal made back. */
  counter?: Proposal;
}

/**
 * `plitzi task answer`: the task asked — or the lead, for it — accepts, rejects or counters a proposal, once.
 * The proposer, if it waits, takes its task back up with the answer in its notes.
 */
export const answerProposal = async (
  ctx: RunContext,
  runId: string,
  proposalId: string,
  reply: { verdict: ProposalAnswer['verdict']; note?: string; counter?: string }
): Promise<Answered> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping'], 'answer a proposal');
  const all = await proposalsOf(loaded);
  const proposal = all.find(each => each.id === proposalId);
  if (!proposal) {
    throw new RunRefusal('not-found', `Run "${runId}" has no proposal "${proposalId}"`, {
      proposals: all.map(each => each.id)
    });
  }

  if (proposal.answer) {
    throw new RunRefusal('invalid', `${proposalId} was answered already: ${proposal.answer.verdict}`, {
      proposal: proposalId
    });
  }

  await holderOrCoordinator(ctx, loaded, findTask(loaded, proposal.to));
  if (reply.verdict === 'counter') {
    if (ctx.token === undefined) {
      throw new RunRefusal('invalid', 'The lead decides: it accepts or rejects; a counter is the task’s');
    }

    if (roundOf(all, proposal) >= PROPOSAL_ROUNDS) {
      throw new RunRefusal(
        'invalid',
        `${proposalId} is round ${String(PROPOSAL_ROUNDS)} of this thread: the lead decides — it accepts or rejects it`,
        { proposal: proposalId }
      );
    }

    if (!reply.counter) {
      throw new RunRefusal('invalid', 'A counter says the change it proposes instead: --counter "…"');
    }
  }

  if (reply.verdict === 'reject' && !reply.note) {
    throw new RunRefusal('invalid', 'A rejection says why: --reject "…"');
  }

  const counter =
    reply.verdict === 'counter' && reply.counter
      ? await writeProposal(loaded, {
          from: proposal.to,
          to: proposal.from,
          change: reply.counter,
          ...(proposal.about ? { about: proposal.about } : {}),
          ...(reply.note ? { why: reply.note } : {}),
          replyTo: proposal.id,
          at: at(ctx)
        })
      : undefined;
  const answer: ProposalAnswer = {
    proposal: proposal.id,
    by: ctx.agent,
    verdict: reply.verdict,
    ...(reply.note ? { note: reply.note } : {}),
    ...(counter ? { counter: counter.id } : {}),
    at: at(ctx)
  };
  const answers = taskPaths(loaded.paths, proposal.to).answers;
  if (!(await createExclusive(path.join(answers, `${proposal.id}.json`), `${JSON.stringify(answer, null, 2)}\n`))) {
    throw new RunRefusal('invalid', `${proposalId} was answered meanwhile`, { proposal: proposalId });
  }

  const proposer = await viewTask(loaded.paths, findTask(loaded, proposal.from));
  if (proposer.state.status === 'waiting' && proposer.state.waitingFor?.proposal === proposal.id) {
    const told = `${proposal.to} ${reply.verdict === 'counter' ? `countered with ${String(counter?.id)}` : `${reply.verdict}ed`} ${proposal.id}${reply.note ? `: ${reply.note}` : ''}`;
    await updateState(
      proposer.paths,
      state => ({
        ...state,
        status: state.round > 0 ? 'changes-requested' : 'in-progress',
        waitingFor: undefined,
        notes: [...state.notes, { at: at(ctx), by: 'plitzi', text: told }]
      }),
      ctx.now
    );
  }

  await logRun(ctx, loaded.paths, { action: 'answer', proposal: proposal.id, verdict: reply.verdict });

  return { answer, ...(counter ? { counter } : {}) };
};
