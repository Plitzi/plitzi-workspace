import { realpathSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { PROJECT_STATE, PROJECT_TMP, projectMark } from '@plitzi/sdk-shared/project';

import { readHealth } from '../browser';
import { projectHere } from './existingProject';
import { fail } from './terminal';
import { copyOf } from '../runs/paths';
import { listenerOn, listenersUnder, stopListener } from '../runs/processes';

/**
 * `plitzi server list` and `plitzi server stop`: this project's own servers — what `npm start` left listening from this
 * folder — and stopping one, never by its name. An agent stopping a hung `cat` with `pkill -f "cat"` matched
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
    const there = copy ? undefined : listenerOn(options.port);
    fail(
      copy
        ? `Port ${String(options.port)} is served from ${copy.cwd} — a run's copy, its agent's: stopped from there (cd ${copy.cwd} && plitzi server stop --port ${String(options.port)}), never from the project. A preview of a task stops by itself once the task is done.`
        : there
          ? `Port ${String(options.port)} is held by pid ${String(there.pid)}, started ${there.cwd ? `in ${there.cwd}` : 'in a folder lsof does not say'} — not this project (${project.root}), so it is left alone. plitzi server list says what is this project's.`
          : `Nothing listens on port ${String(options.port)}: a server started there has already stopped — nothing to stop (${project.root}).`
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

export interface ServerResetOptions {
  dryRun?: boolean;
  json?: boolean;
}

/**
 * Puts what this folder's server keeps (`state/` — its kv, its jobs) back to a cold start: the next start is a fresh
 * clone's. A reviewer's `page play` used the demo's data up, and emptying the copy's sqlite by hand was the only
 * way back. A server of this folder holds the files open and writes them back: in a run's copy — served by its page
 * commands — it is stopped first and said (a run's designers were refused six times, and ran reset again in bursts);
 * in the project itself it may be a person's, and the reset is refused until they stop it.
 */
/** Whether every server listening from inside `root` has stopped within `ms`. */
const stoppedWithin = async (root: string, ms: number): Promise<boolean> => {
  const until = Date.now() + ms;
  for (;;) {
    if (listenersUnder(root).filter(each => !inside(each.cwd, path.join(root, PROJECT_TMP))).length === 0) {
      return true;
    }

    if (Date.now() > until) {
      return false;
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }
};

export const serverReset = async (options: ServerResetOptions): Promise<void> => {
  const project = await projectHere('whose server state to reset');
  if (!project) {
    return;
  }

  const running = listenersUnder(realpathSync(project.root)).filter(
    each => !inside(each.cwd, path.join(realpathSync(project.root), PROJECT_TMP))
  );
  const inCopy = copyOf(realpathSync(project.root)) !== undefined;
  if (running.length > 0 && !inCopy) {
    fail(
      `A server of this folder is running on ${running.map(each => `:${String(each.port)}`).join(', ')} and holds ${PROJECT_STATE}/ open — it would write it back. Stop it first (plitzi server stop), then reset.`
    );

    return;
  }

  // The copy's own, started by its page commands: stopped, and waited for — it writes what it holds as it goes.
  for (const each of running) {
    stopListener(each.pid);
  }

  const stopped = running.length > 0 ? await stoppedWithin(realpathSync(project.root), 10_000) : true;
  if (!stopped) {
    fail(
      `The copy's server on ${running.map(each => `:${String(each.port)}`).join(', ')} did not stop within 10 seconds: ${PROJECT_STATE}/ is left as it is — run plitzi server reset again in a moment.`
    );

    return;
  }

  const dir = path.join(project.root, PROJECT_STATE);
  const kept = await fs.readdir(dir).catch(() => []);
  if (!options.dryRun && kept.length > 0) {
    await fs.rm(dir, { recursive: true, force: true });
  }

  if (options.json) {
    console.log(JSON.stringify({ removed: options.dryRun ? [] : kept, wouldRemove: options.dryRun ? kept : [] }));

    return;
  }

  if (running.length > 0) {
    console.log(
      `Stopped this copy's server on ${running.map(each => `:${String(each.port)}`).join(', ')} first: it held ${PROJECT_STATE}/ open. The next page command starts it again.`
    );
  }

  console.log(
    kept.length === 0
      ? `Already cold: no ${PROJECT_STATE}/ in ${project.root} — the next start is a fresh one.`
      : options.dryRun
        ? `Would remove ${PROJECT_STATE}/ (${kept.join(', ')}) — what the server kept. Without --dry-run, it does.`
        : chalk.green(
            `Removed ${PROJECT_STATE}/ (${kept.join(', ')}): the next start is a cold start, as on a fresh clone.`
          )
  );
};
