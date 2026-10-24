import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { LATER_ANSWER_FILE, LATER_ASK_FILE } from '@plitzi/sdk-shared/project';

import { projectHere } from './existingProject';
import { fail } from './terminal';

/**
 * `plitzi functions later [key] --now`: what the project's running server holds to run later (`ctx.later`), and one of
 * them started now — asked through the project's `tmp/`, since the server holds its queue's file. A spec of something
 * that starts in five minutes waited the five, every pass (encore-3's shows).
 */

export interface FunctionsLaterOptions {
  now?: boolean;
  json?: boolean;
}

type Waiting = { job: string; action: string; key?: string; dueAt: number };

/** How long the server is waited for: it looks every half second. */
const WAIT_MS = 5000;

const waitingOf = (value: unknown): Waiting | undefined =>
  isRecord(value) &&
  typeof value.job === 'string' &&
  typeof value.action === 'string' &&
  typeof value.dueAt === 'number'
    ? {
        job: value.job,
        action: value.action,
        dueAt: value.dueAt,
        ...(typeof value.key === 'string' ? { key: value.key } : {})
      }
    : undefined;

const dueText = (dueAt: number, now: number): string => {
  const minutes = Math.round((dueAt - now) / 60_000);
  const at = new Date(dueAt).toISOString().slice(11, 16);

  return minutes <= 0 ? `due now (${at} UTC)` : `due in ${String(minutes)} min (${at} UTC)`;
};

const answerFor = async (root: string, id: string): Promise<Record<string, unknown> | undefined> => {
  const file = path.join(root, LATER_ANSWER_FILE);
  for (const started = Date.now(); Date.now() - started < WAIT_MS;) {
    const read: unknown = await fs
      .readFile(file, 'utf-8')
      .then(text => JSON.parse(text) as unknown)
      .catch(() => undefined);
    if (isRecord(read) && read.id === id) {
      await fs.rm(file, { force: true });

      return read;
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return undefined;
};

export const functionsLater = async (key: string | undefined, options: FunctionsLaterOptions): Promise<void> => {
  if (options.now === true && key === undefined) {
    fail('--now starts one run set for later: name it by its key — plitzi functions later <key> --now');

    return;
  }

  const project = await projectHere('whose server holds the runs set for later');
  if (!project) {
    return;
  }

  const id = randomUUID();
  const asked = path.join(project.root, LATER_ASK_FILE);
  await fs.mkdir(path.dirname(asked), { recursive: true });
  await fs.writeFile(
    asked,
    JSON.stringify(options.now === true && key !== undefined ? { id, ask: 'now', key } : { id, ask: 'list' })
  );
  const answer = await answerFor(project.root, id);
  if (answer === undefined) {
    await fs.rm(asked, { force: true });
    fail(
      'The project’s server did not answer: it holds the runs set for later while it is served — npm start (a task’s copy: its own server, started by its checks or by you in it)'
    );

    return;
  }

  if (typeof answer.problem === 'string') {
    fail(`${answer.problem}.`);

    return;
  }

  if (options.json) {
    console.log(JSON.stringify(answer));

    return;
  }

  const now = Date.now();
  const started = waitingOf(answer.started);
  if (started) {
    console.log(
      `Started ${started.key ?? started.job} now — ${started.action}, its input as it was set: the server’s worker takes it within a second.`
    );

    return;
  }

  const waiting = (Array.isArray(answer.waiting) ? answer.waiting : []).flatMap(each => {
    const read = waitingOf(each);

    return read ? [read] : [];
  });
  const shown = key === undefined ? waiting : waiting.filter(each => each.key === key);
  console.log(
    shown.length === 0
      ? key === undefined
        ? 'Nothing waits to run later.'
        : `Nothing waits to run later under "${key}".`
      : [
          ...shown.map(
            each =>
              `${(each.key ?? each.job).padEnd(28)} ${each.action.padEnd(24)} ${chalk.dim(dueText(each.dueAt, now))}`
          ),
          chalk.dim('Start one now: plitzi functions later <key> --now')
        ].join('\n')
  );
};
