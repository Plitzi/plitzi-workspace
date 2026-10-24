import { realpathSync } from 'node:fs';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { PROJECT_TMP, projectMark } from '@plitzi/sdk-shared/project';

import { readHealth } from '../browser';
import { projectHere } from './existingProject';
import { fail } from './terminal';
import { listenersUnder, stopListener } from '../runs/processes';

/**
 * `plitzi server list` and `plitzi server stop`: this project's own servers — what `npm start` left listening from this
 * folder — and stopping one, never by its name. encore: an agent stopping a hung `cat` with `pkill -f "cat"` matched
 * every process whose command line held those letters (`/Applications/…` among them) and took the machine down. A
 * server is this project's when it listens from its folder (a run's copies, under `tmp/`, are each their own) and its
 * `/health` says it serves this folder (`projectMark`); anything else on a port is somebody else's, said and left.
 */

export interface ProjectServer {
  pid: number;
  port: number;
  /** The folder it was started in. */
  cwd: string;
  /** What its `/health` says of it: this folder's server, another folder's, or no Plitzi server at all. */
  serves: 'this' | 'another' | 'unknown';
}

const inside = (child: string, parent: string): boolean => child === parent || child.startsWith(`${parent}${path.sep}`);

/** What a server's `/health` says it serves, against this folder's mark. */
const servesOf = async (port: number, root: string): Promise<ProjectServer['serves']> => {
  const health = await readHealth(`http://127.0.0.1:${String(port)}`);
  const instance = isRecord(health) && typeof health.Instance === 'string' ? health.Instance : undefined;
  if (instance === undefined) {
    return 'unknown';
  }

  return instance === projectMark(root) ? 'this' : 'another';
};

/**
 * What listens from this folder — its own `tmp/` (a run's copies, the CLI's caches) left out — with what each says it
 * serves.
 */
export const projectServers = async (root: string): Promise<ProjectServer[]> => {
  // lsof says each folder with its links resolved — `/tmp` is `/private/tmp` on macOS.
  const real = realpathSync(root);
  const own = listenersUnder(real).filter(each => !inside(each.cwd, path.join(real, PROJECT_TMP)));

  return Promise.all(own.map(async each => ({ ...each, serves: await servesOf(each.port, root) })));
};

const serverText = (each: ProjectServer): string =>
  `${String(each.port)} (pid ${String(each.pid)}, ${each.serves === 'this' ? 'this project' : each.serves === 'another' ? 'another folder’s Plitzi server' : 'no Plitzi server'})`;

export interface ServerStopOptions {
  port?: number;
  json?: boolean;
}

export const serverList = async (options: { json?: boolean }): Promise<void> => {
  const project = await projectHere('whose servers to list');
  if (!project) {
    return;
  }

  const servers = await projectServers(project.root);
  if (options.json) {
    console.log(JSON.stringify({ servers }));

    return;
  }

  console.log(
    servers.length === 0
      ? `Nothing of this project listens (${project.root}).`
      : [`This project's servers:`, ...servers.map(each => `  ${serverText(each)}`)].join('\n')
  );
};

/**
 * Stops this project's server on `port` — or every one, none named — and what it started: one that is not this
 * project's (another folder's, or no Plitzi server) is refused, saying whose, and nothing is stopped by name.
 */
export const serverStop = async (options: ServerStopOptions): Promise<void> => {
  const project = await projectHere('whose server to stop');
  if (!project) {
    return;
  }

  const servers = await projectServers(project.root);
  const asked = options.port === undefined ? servers : servers.filter(each => each.port === options.port);
  if (options.port !== undefined && asked.length === 0) {
    // A run's copy serving it is its agent's, left out on purpose — said with where to stop it from, if it must be.
    const copy = listenersUnder(realpathSync(project.root)).find(
      each => each.port === options.port && inside(each.cwd, path.join(realpathSync(project.root), PROJECT_TMP))
    );
    fail(
      copy
        ? `Port ${String(options.port)} is served from ${copy.cwd} — a run's copy, its agent's: stopped from there (cd ${copy.cwd} && plitzi server stop --port ${String(options.port)}), never from the project. A preview of a task stops by itself once the task is done.`
        : `Nothing of this project listens on port ${String(options.port)} (${project.root}): what does listen there is no server started from this folder, and is left alone. plitzi server list says what is this project's.`
    );

    return;
  }

  const mine = asked.filter(each => each.serves === 'this');
  const others = asked.filter(each => each.serves !== 'this');
  for (const each of mine) {
    stopListener(each.pid);
  }

  if (options.json) {
    console.log(JSON.stringify({ stopped: mine, left: others }));
  } else {
    console.log(
      [
        mine.length > 0
          ? chalk.green(`Stopped ${mine.map(serverText).join(', ')} — and what each started.`)
          : 'No server of this project to stop.',
        ...others.map(
          each =>
            `  Left: ${serverText(each)} — started in this folder, but its /health does not say this project: stop it yourself if it is yours.`
        )
      ].join('\n')
    );
  }

  if (options.port !== undefined && mine.length === 0) {
    process.exitCode = 1;
  }
};
