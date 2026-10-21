import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readJson, writeJson } from './files';
import { LEAD, messagesOf } from './messages';

import type { Message } from './messages';
import type { LoadedRun, RunContext } from './run/context';

/**
 * A question to the lead answered by a lead that reviews: one with a lead's model, there while the lead is at something
 * else — velada-dress's agents waited a median 7.8 minutes for the lead's answers. A lead that reviews is handed the
 * oldest question no other lead took, when no review waits for it (`task next --role lead`); what is the person's to
 * decide, or changes the plan, it leaves to the lead. The lead is woken for it only once it waited `UNTAKEN_REVIEW_MS`
 * unanswered.
 */

interface Taken {
  by: string;
  at: string;
}

const isTaken = (value: unknown): value is Record<string, Taken> =>
  isRecord(value) &&
  Object.values(value).every(each => isRecord(each) && typeof each.by === 'string' && typeof each.at === 'string');

const fileOf = (loaded: LoadedRun): string => path.join(loaded.paths.dir, 'answering.json');

/** Who of the leads took each question, by its id, and when. */
export const answering = async (loaded: LoadedRun): Promise<Record<string, Taken>> =>
  (await readJson(fileOf(loaded), isTaken, 'the questions the leads took').catch(() => undefined)) ?? {};

/** The questions to the lead nobody answered yet, oldest first. */
export const openQuestions = async (loaded: LoadedRun): Promise<Message[]> => {
  const messages = await messagesOf(loaded);
  const answered = new Set(messages.flatMap(message => (message.replyTo ? [message.replyTo] : [])));

  return messages
    .filter(message => message.to === LEAD && message.fyi !== true && !answered.has(message.id))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
};

/** The oldest open question no other lead took: what a lead that reviews answers when no review waits. */
export const questionFor = async (ctx: RunContext, loaded: LoadedRun): Promise<Message | undefined> => {
  const taken = await answering(loaded);

  return (await openQuestions(loaded)).find(
    question => !Object.hasOwn(taken, question.id) || taken[question.id].by === ctx.agent
  );
};

/** Takes `question` for `ctx.agent`: another lead is not handed it. */
export const takeQuestion = async (ctx: RunContext, loaded: LoadedRun, question: string): Promise<void> => {
  const taken = await answering(loaded);
  if (!Object.hasOwn(taken, question)) {
    await writeJson(fileOf(loaded), { ...taken, [question]: { by: ctx.agent, at: ctx.now().toISOString() } });
  }
};
