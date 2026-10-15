import { setTimeout as delay } from 'node:timers/promises';

import chalk from 'chalk';

import { activityLine, ACTIVITY_WAIT_MAX_SECONDS, isSpaceActivityPage } from '@plitzi/sdk-shared/activity';

import { connectToSpace } from './account';
import { fail } from './terminal';
import { authorizedRequest } from '../account/session';

import type { AccountOptions } from './account';
import type { Connection } from '../account/connection';
import type { SpaceActivityPage } from '@plitzi/sdk-shared/activity';

/**
 * `plitzi space activity`: what happened on the space the CLI works in — the draft changed (a person in the builder, an
 * agent over the MCP, the autofix), a version went out, an action failed. With `--follow`, it stays and says each as it
 * happens: what an agent runs in the background to hear of a person's edit, or of a flow it broke, without reading the
 * space again and again. The person's own pushes are left out, and counted; `--mine` keeps them.
 *
 *   plitzi space activity
 *   plitzi space activity --follow --json     # one page a line, as it arrives
 */

export interface ActivityOptions extends AccountOptions {
  follow?: boolean;
  /** The cursor a previous read gave: read from there, not from the latest. */
  after?: string;
  mine?: boolean;
  limit?: number;
  json?: boolean;
}

/** How long a follower waits before asking again after the platform did not answer. */
const RETRY_MS = 5_000;

type Read = { page: SpaceActivityPage; connection: Connection } | { problem: string; transient: boolean };

const readPage = async (
  connection: Connection,
  spaceId: number,
  { after, wait, limit, mine }: { after?: string; wait: number; limit?: number; mine: boolean }
): Promise<Read> => {
  const query = new URLSearchParams({
    ...(after === undefined ? {} : { after }),
    ...(wait > 0 ? { wait: String(wait) } : {}),
    ...(limit === undefined ? {} : { limit: String(limit) }),
    ...(mine ? { mine: 'true' } : {})
  });
  const answered = await authorizedRequest<unknown>(
    connection,
    `/spaces/${String(spaceId)}/activity${query.size > 0 ? `?${query.toString()}` : ''}`
  );
  if (!answered.ok) {
    // Never reached it: a server restarting, a network dropped — worth asking again.
    return { problem: answered.error, transient: true };
  }

  const { reply } = answered.value;
  if (reply.status === 200 && isSpaceActivityPage(reply.data)) {
    return { page: reply.data, connection: answered.value.connection };
  }

  const said =
    typeof reply.data === 'object' &&
    reply.data !== null &&
    'error' in reply.data &&
    typeof reply.data.error === 'string'
      ? reply.data.error
      : undefined;
  if (reply.status === 404) {
    return {
      problem: said ?? 'The platform does not keep the activity of its spaces (404): it is older than this CLI.',
      transient: false
    };
  }

  return {
    problem: said ?? `The platform answered ${String(reply.status)} with no activity.`,
    transient: reply.status >= 500
  };
};

const time = (at: number): string => new Date(at).toLocaleTimeString();

/** A page as lines a person scans: each activity at its time, and what was left out. */
export const pageText = (page: SpaceActivityPage): string[] => [
  ...page.activity.map(activity => `${chalk.dim(time(activity.at))}  ${activityLine(activity)}`),
  ...(page.skippedMine > 0
    ? [chalk.dim(`${String(page.skippedMine)} of your own pushes left out (--mine keeps them)`)]
    : [])
];

/**
 * Pages after `after`, each waited for, said as they arrive until `signal` aborts. A platform that does not answer is
 * asked again; one that refuses — a cursor it did not give out — ends it.
 */
export const followActivity = async (
  start: Connection,
  spaceId: number,
  options: ActivityOptions & { after: string },
  signal?: AbortSignal
): Promise<void> => {
  let connection = start;
  let after = options.after;
  while (!signal?.aborted) {
    const read = await readPage(connection, spaceId, {
      after,
      wait: ACTIVITY_WAIT_MAX_SECONDS,
      limit: options.limit,
      mine: Boolean(options.mine)
    });
    if ('problem' in read) {
      if (!read.transient) {
        fail(read.problem);

        return;
      }

      console.error(chalk.yellow(`${read.problem} Asking again in ${String(RETRY_MS / 1000)} s.`));
      await delay(RETRY_MS, undefined, signal ? { signal } : {}).catch(() => undefined);
      continue;
    }

    ({ connection } = read);
    after = read.page.cursor;
    if (read.page.activity.length === 0 && read.page.skippedMine === 0) {
      continue;
    }

    console.log(options.json ? JSON.stringify(read.page) : pageText(read.page).join('\n'));
  }
};

export const activity = async (options: ActivityOptions): Promise<void> => {
  const connection = await connectToSpace(options, 'to follow');
  const space = connection?.space;
  if (!connection || !space) {
    return;
  }

  const first = await readPage(connection, space.id, {
    ...(options.after === undefined ? {} : { after: options.after }),
    wait: 0,
    limit: options.limit,
    mine: Boolean(options.mine)
  });
  if ('problem' in first) {
    fail(first.problem);

    return;
  }

  const { page } = first;
  if (options.json) {
    console.log(JSON.stringify(page));
  } else {
    const lines = pageText(page);
    console.log(lines.length > 0 ? lines.join('\n') : chalk.dim(`Nothing on ${space.name} yet.`));
  }

  if (!options.follow) {
    if (!options.json) {
      console.log(
        chalk.dim(`${page.more ? 'More is there. ' : ''}What comes next: plitzi space activity --after ${page.cursor}`)
      );
    }

    return;
  }

  if (!options.json) {
    console.log(chalk.dim(`Following ${space.name} — ^C to stop.`));
  }

  await followActivity(first.connection, space.id, { ...options, after: page.cursor });
};
