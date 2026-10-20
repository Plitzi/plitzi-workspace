import { writeJson } from './files';
import { agentAddress, LEAD, messagesOf, replyTo, sendMessage, unreadFor, unreadForHolder } from './messages';
import { assertStatus, loadRun, logRun, requireNoTask } from './run';
import { findTask, holderOf } from './tasks';
import { viewTask } from './taskStore';

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
    await new Promise(resolve => setTimeout(resolve, everyMs));
  }
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
  const sent: Message[] = [];
  for (const target of targets) {
    sent.push(await sendMessage(ctx, loaded, { from: LEAD, to: target, text, ...(reply ? { replyTo: reply } : {}) }));
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
