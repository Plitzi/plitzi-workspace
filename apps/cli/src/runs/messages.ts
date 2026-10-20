import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { createExclusive, readJson, writeJson } from './files';
import { taskPaths } from './paths';
import { RunRefusal } from './refusal';

import type { LoadedRun, RunContext } from './run';

/**
 * The lead and the agents talking while a task is worked (RFC 0028): an agent asks when it is stuck (`task ask`), the
 * lead gives instructions to one task or to all at once (`task message`). What is unread reaches an agent with its next
 * heartbeat, progress or completion, so it never has to look — and the lead sees questions on top of `run status`. A
 * message is data for its reader to weigh, never an order that skips the plan.
 */

/** Who speaks: the lead, a task by its id — or, to reach an agent whichever task it holds, `@` and its name. */
export const LEAD = 'lead';

const AGENT = /^@[\w.-]{1,64}$/;

/** The address of an agent by its name (`--agent`): what reaches it between tasks, and with whichever task it holds. */
export const agentAddress = (name: string): string => `@${name}`;

export interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  at: string;
  /** The message it answers. */
  replyTo?: string;
}

const isMessage = (value: unknown): value is Message =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.from === 'string' &&
  typeof value.to === 'string' &&
  typeof value.text === 'string' &&
  typeof value.at === 'string' &&
  (value.replyTo === undefined || typeof value.replyTo === 'string');

const isRead = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(each => typeof each === 'string');

export const messagesOf = async (loaded: LoadedRun): Promise<Message[]> => {
  const names = (await fs.readdir(loaded.paths.messages).catch(() => [])).filter(name => name.endsWith('.json')).sort();
  const all: Message[] = [];
  for (const name of names) {
    const message = await readJson(path.join(loaded.paths.messages, name), isMessage, 'a message of the run');
    if (message) {
      all.push(message);
    }
  }

  return all.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
};

const readFile = (loaded: LoadedRun, reader: string): string =>
  reader === LEAD
    ? loaded.paths.leadRead
    : AGENT.test(reader)
      ? path.join(path.dirname(loaded.paths.messages), 'agents-read', `${reader.slice(1)}.json`)
      : taskPaths(loaded.paths, reader).read;

/** What `reader` has not read yet — the lead, or a task — marked read as it is handed over when `mark`. */
export const unreadFor = async (loaded: LoadedRun, reader: string, mark: boolean): Promise<Message[]> => {
  const read = new Set((await readJson(readFile(loaded, reader), isRead, 'the messages read')) ?? []);
  const unread = (await messagesOf(loaded)).filter(message => message.to === reader && !read.has(message.id));
  if (mark && unread.length > 0) {
    await writeJson(readFile(loaded, reader), [...read, ...unread.map(message => message.id)]);
  }

  return unread;
};

/**
 * What the holder of `taskId` has not read: said to the task, and to its agent by name — marked read as it is handed
 * over when `mark`.
 */
export const unreadForHolder = async (
  loaded: LoadedRun,
  taskId: string,
  agent: string,
  mark: boolean
): Promise<Message[]> => {
  const toTask = await unreadFor(loaded, taskId, mark);
  const toAgent = AGENT.test(agentAddress(agent)) ? await unreadFor(loaded, agentAddress(agent), mark) : [];

  return [...toTask, ...toAgent].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
};

/** Writes a message under the next free id: created exclusively, so two never share one. */
export const sendMessage = async (
  ctx: RunContext,
  loaded: LoadedRun,
  message: Omit<Message, 'id' | 'at'>
): Promise<Message> => {
  if (message.text.trim() === '') {
    throw new RunRefusal('invalid', 'A message says something: the text is empty');
  }

  if (message.to !== LEAD && !AGENT.test(message.to) && !loaded.tasks.some(task => task.id === message.to)) {
    throw new RunRefusal('not-found', `Run "${loaded.record.runId}" has no task "${message.to}"`, { task: message.to });
  }

  if (message.replyTo !== undefined && !(await messagesOf(loaded)).some(each => each.id === message.replyTo)) {
    throw new RunRefusal('not-found', `There is no message "${message.replyTo}" to answer`);
  }

  await fs.mkdir(loaded.paths.messages, { recursive: true });
  for (let n = (await fs.readdir(loaded.paths.messages)).length + 1; ; n += 1) {
    const written: Message = { id: `m${String(n)}`, at: ctx.now().toISOString(), ...message };
    if (
      await createExclusive(
        path.join(loaded.paths.messages, `${written.id}.json`),
        `${JSON.stringify(written, null, 2)}\n`
      )
    ) {
      return written;
    }
  }
};

/** The answer to `question`, if one came: a message to its sender that replies to it. */
export const replyTo = async (loaded: LoadedRun, question: Message): Promise<Message | undefined> =>
  (await messagesOf(loaded)).find(message => message.replyTo === question.id && message.to === question.from);
