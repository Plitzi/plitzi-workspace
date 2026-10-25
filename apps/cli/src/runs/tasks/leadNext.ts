import { questionFor } from '../answering';
import { isCoLead, isPrincipal, leadReviewFor, markAsking } from '../leads';
import { RunRefusal } from '../refusal';
import { DESIGNER, readTeam, startedAgents } from '../team';
import { byUrgency } from '../urgency';
import { isWorked } from '../worked';
import { reviewOffer } from './reviewOffer';

import type { Message } from '../messages';
import type { LoadedRun, RunContext } from '../run';
import type { TaskView } from '../taskStore';
import type { NextTask } from './next';

/** `task next --role lead`: the review a lead takes next, why there is none, or that the run has none left for it. */
export const leadNext = async (
  ctx: RunContext,
  loaded: LoadedRun,
  views: readonly TaskView[],
  messages: Message[]
): Promise<Omit<NextTask, 'scratch'>> => {
  const { record } = loaded;
  if (!isCoLead(record, ctx.agent) && !isPrincipal(ctx.agent)) {
    throw new RunRefusal(
      'invalid',
      `${ctx.agent} is no lead of this run: its leads are lead${(record.leads ?? []).map(each => `, ${each}`).join('')} — a lead that reviews waits with plitzi task next --role lead --agent <its name> — its first command; its token after`
    );
  }

  // Asking is running: while it is, `lead` leaves the reviews to it.
  if (isCoLead(record, ctx.agent)) {
    await markAsking(ctx, loaded);
  }

  // A UI review waits for a designer; with none free — each at a task of its own, or none in the team — it waits for
  // nobody, and every review behind it with it (seven tasks in review, the one designer redoing its own).
  const team = await readTeam(ctx.root).catch(() => undefined);
  const designers = (team ? startedAgents(team) : [])
    .filter(each => each.roles.includes(DESIGNER))
    .map(each => each.agent);
  const busy = (agent: string): boolean =>
    views.some(view => view.owner?.agent === agent && isWorked(view.state.status));
  const noDesignerFree = designers.every(busy);
  const review = leadReviewFor(views, ctx.agent, noDesignerFree);
  if (review) {
    return {
      leadReview: await reviewOffer(
        review,
        review.state.design?.status === 'due'
          ? `its UI waits for a designer and none is free${designers.length > 0 ? ` (${designers.join(', ')} at a task of its own)` : ''}: review its UI too — as the original, both schemes, the phone width — and approve with --skip-design lead, which the report says as the lead's UI review`
          : undefined
      ),
      ready: [],
      messages
    };
  }

  // No review for it: a question to the lead, which holds an agent — the oldest no other lead took. The lead's own
  // is the lead's to answer: it does not ask itself.
  const question = isPrincipal(ctx.agent) ? undefined : await questionFor(ctx, loaded);
  if (question) {
    const asker = views.find(view => view.task.id === question.from)?.owner?.agent;

    return {
      question: { id: question.id, task: question.from, text: question.text, ...(asker ? { agent: asker } : {}) },
      ready: [],
      messages
    };
  }

  // No question either: a spike, as every spike is a lead's — the most urgent no other lead is finding out.
  const urgency = byUrgency(loaded.tasks);
  const spike = views
    .filter(view => view.state.status === 'spike' && (view.state.spikedBy?.by ?? ctx.agent) === ctx.agent)
    .sort((a, b) => urgency(a.task, b.task) || a.task.id.localeCompare(b.task.id))
    .at(0);
  if (spike) {
    return {
      spike: {
        task: spike.task,
        question: spike.task.spike ?? 'what it needs',
        findings: spike.state.findings?.length ?? 0
      },
      ready: [],
      messages
    };
  }

  const open = views.filter(view => view.state.status !== 'done');
  if (open.length === 0) {
    return { why: 'every task is done: no review is left. You can stop', ready: [], messages, finished: true };
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
    ].join(', ')} — wait for one: the same command without --no-wait`,
    ready: [],
    messages
  };
};
