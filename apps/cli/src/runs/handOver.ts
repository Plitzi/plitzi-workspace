import { messagesOf, unreadForHolder } from './messages';
import { logRun } from './run';

import type { Message } from './messages';
import type { LoadedRun, RunContext } from './run';

/**
 * What the holder of `taskId` has not read, handed over and marked read — and, for each answer to a question the task
 * asked, the task taken up again: said in the activity the moment its agent has the answer, at whatever command, as a
 * person goes back to work once answered. Until then the task is held on its question (t-fights stood
 * answered and nowhere at work while dev-1 had not read it).
 */
export const handOver = async (
  ctx: RunContext,
  loaded: LoadedRun,
  taskId: string,
  agent: string
): Promise<Message[]> => {
  const messages = await unreadForHolder(loaded, taskId, agent, true);
  const replies = messages.filter(message => message.replyTo !== undefined);
  if (replies.length > 0) {
    const asked = new Set(
      (await messagesOf(loaded)).filter(message => message.from === taskId).map(message => message.id)
    );
    for (const reply of replies.filter(each => each.replyTo !== undefined && asked.has(each.replyTo))) {
      await logRun(ctx, loaded.paths, { action: 'resumes', task: taskId, question: reply.replyTo, answer: reply.id });
    }
  }

  return messages;
};
