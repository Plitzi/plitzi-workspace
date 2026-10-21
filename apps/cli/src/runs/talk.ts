import { writeJson } from './files';
import { requireLead } from './leads';
import { agentAddress, EVERYONE, LEAD, messagesOf, replyTo, sendMessage, unreadFor, unreadForHolder } from './messages';
import { RunRefusal } from './refusal';
import { assertStatus, loadRun, logRun, requireNoTask } from './run';
import { runChanged } from './runChanged';
import { findTask, holderOf } from './tasks';
import { viewTask } from './taskStore';
import { readTeam, startedAgents } from './team';

import type { Message } from './messages';
import type { RunContext } from './run';

/**
 * What `plitzi task ask`, `plitzi task message` and `plitzi task inbox` do: the lead and the agents talking while tasks
 * are worked (`messages.ts`).
 */

export interface Asked {
  question: Message;
  /** With `follow`: the lead's answer, once it came. */
  reply?: Message;
  /** What else the lead said to the task and it had not read, handed over with the answer. */
  messages: Message[];
}

/**
 * `plitzi task ask`: the holder of a task asks the lead — stuck, unsure, or with news it needs to hear. With `follow` it
 * stays until the answer comes (its sign of life given meanwhile), up to `timeoutMs`.
 */
export const askLead = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  text: string,
  { follow = false, timeoutMs = 30 * 60_000, everyMs = 10_000 } = {}
): Promise<Asked> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping', 'reconciliation'], 'ask the lead');
  const view = await holderOf(ctx, loaded, findTask(loaded, taskId));
  const question = await sendMessage(ctx, loaded, { from: taskId, to: LEAD, text });
  await logRun(ctx, loaded.paths, { action: 'ask', task: taskId, message: question.id });
  if (!follow) {
    return { question, messages: [] };
  }

  const started = Date.now();
  for (;;) {
    const reply = await replyTo(await loadRun(ctx, runId), question);
    if (reply) {
      // Everything marked read is handed over: a message is never read for the agent without reaching it.
      const unread = await unreadFor(loaded, taskId, true);

      return { question, reply, messages: unread.filter(message => message.id !== reply.id) };
    }

    if (Date.now() - started >= timeoutMs) {
      return { question, messages: [] };
    }

    await writeJson(view.paths.progress, { ...(view.progress ?? {}), heartbeatAt: ctx.now().toISOString() });
    await runChanged(loaded.paths.dir, everyMs);
  }
};

/**
 * `plitzi run note`: the lead tells every task — in hand, and taken from now on — what holds for the whole run: a known
 * issue, a decision, how something is done here. The run's memory; each task reads it once, with its take or its next
 * sign of life.
 */
export const noteRun = async (ctx: RunContext, runId: string, text: string): Promise<Message> => {
  requireNoTask(ctx, 'add a note to the run');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, loaded, 'add a note to every task');
  const note = await sendMessage(ctx, loaded, { from: LEAD, to: EVERYONE, text });
  await logRun(ctx, loaded.paths, { action: 'note', message: note.id });

  return note;
};

/**
 * `plitzi task tell`: the holder of a task tells the lead something it should know — a finding, a choice it made, a
 * risk — without asking: nothing waits for an answer. It is on top of `run status` until the lead reads its inbox.
 */
export const tellLead = async (ctx: RunContext, runId: string, taskId: string, text: string): Promise<Message> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping', 'reconciliation'], 'tell the lead');
  await holderOf(ctx, loaded, findTask(loaded, taskId));
  const told = await sendMessage(ctx, loaded, { from: taskId, to: LEAD, text, fyi: true });
  await logRun(ctx, loaded.paths, { action: 'tell', task: taskId, message: told.id });

  return told;
};

/**
 * `plitzi task tell --about <task>` with no task in hand: an agent of the team that holds none — a designer between
 * reviews — tells the lead what it found on a task, said by its own name. A review the lead decided first had nowhere to
 * go (la-velada: design-1's finding on t-motion, refused twice).
 */
export const tellLeadAbout = async (ctx: RunContext, runId: string, about: string, text: string): Promise<Message> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping', 'reconciliation'], 'tell the lead');
  const task = findTask(loaded, about);
  const team = await readTeam(ctx.root).catch(() => undefined);
  if (!(team ? startedAgents(team) : []).some(member => member.agent === ctx.agent)) {
    throw new RunRefusal(
      'invalid',
      `${ctx.agent} is no agent of the team: an agent tells the lead as itself (--agent <its name>), a task's holder with its token`,
      { task: task.id }
    );
  }

  const told = await sendMessage(ctx, loaded, { from: ctx.agent, to: LEAD, text: `On ${task.id}: ${text}`, fyi: true });
  await logRun(ctx, loaded.paths, { action: 'tell', task: task.id, message: told.id });

  return told;
};

/**
 * `plitzi task message`: the lead tells a task — or every task in hand, with `all`, or an agent by name, `@dev-1`,
 * whichever task it holds or none — what it needs to know: an instruction, an answer, a change of plan. It reaches the
 * agent with its next command; an agent between tasks, with `task next`.
 */
export const messageTasks = async (
  ctx: RunContext,
  runId: string,
  to: string,
  text: string,
  reply?: string
): Promise<Message[]> => {
  requireNoTask(ctx, 'message a task');
  const loaded = await loadRun(ctx, runId);
  const inHand = await Promise.all(
    loaded.tasks.map(async task => ({ task, view: await viewTask(loaded.paths, task) }))
  );
  const targets =
    to === 'all'
      ? inHand.filter(each => each.view.owner && each.view.state.status !== 'done').map(each => each.task.id)
      : to.startsWith('@')
        ? [to]
        : [findTask(loaded, to).id];
  // What the lead says to a task with a question open is its answer, said with --reply-to or not: velada-now's lead
  // answered t-motion without it, and the monitor said for good that t-motion asked the lead.
  const messages = await messagesOf(loaded);
  const answered = new Set(messages.flatMap(message => (message.replyTo ? [message.replyTo] : [])));
  const openQuestion = (target: string): string | undefined =>
    messages
      .filter(
        message => message.from === target && message.to === LEAD && message.fyi !== true && !answered.has(message.id)
      )
      .at(-1)?.id;
  const sent: Message[] = [];
  for (const target of targets) {
    const answers = reply ?? openQuestion(target);
    sent.push(
      await sendMessage(ctx, loaded, { from: LEAD, to: target, text, ...(answers ? { replyTo: answers } : {}) })
    );
  }

  await logRun(ctx, loaded.paths, { action: 'message', to, messages: sent.map(message => message.id) });

  return sent;
};

/**
 * `plitzi task inbox`: what was said to the caller and it has not read — a task's with its token, the lead's without.
 * With `all`, every message to it and from it, read or not: what it was told before, again.
 */
export const readInbox = async (ctx: RunContext, runId: string, taskId?: string, all = false): Promise<Message[]> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  if (taskId === undefined) {
    requireNoTask(ctx, 'read the lead’s inbox');
    await requireLead(ctx, loaded, 'read the lead’s inbox');

    return all
      ? (await messagesOf(loaded)).filter(message => message.to === LEAD || message.from === LEAD)
      : unreadFor(loaded, LEAD, true);
  }

  await holderOf(ctx, loaded, findTask(loaded, taskId));
  const agent = agentAddress(ctx.agent);
  if (all) {
    return (await messagesOf(loaded)).filter(
      message => message.to === taskId || message.from === taskId || message.to === agent
    );
  }

  return unreadForHolder(loaded, taskId, ctx.agent, true);
};
