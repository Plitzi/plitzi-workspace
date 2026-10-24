import { spawn, spawnSync } from 'node:child_process';

import type { ChildProcess } from 'node:child_process';

/**
 * A project's server, started through a shell (`npm start`'s script) by the run — for a check, or a preview — and
 * stopped as the whole it is: the shell and what it started. Killing the shell alone leaves the server listening.
 */

/**
 * Spawn options that give a server no terminal its own process group, so `stopTree(child, { group: true })` reaches the
 * whole. One the person watches (a preview, in their terminal) stays in theirs: their Ctrl-C reaches it too.
 */
export const TREE = { detached: process.platform !== 'win32' } as const;

/**
 * Every process under `pid`, read off the system's process table (`ps`): what a shell started, and what that started.
 * Nothing where there is no `ps` to ask.
 */
export const descendantsOf = (pid: number): number[] => {
  const table = spawnSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf-8' });
  if (table.status !== 0) {
    return [];
  }

  const children = new Map<number, number[]>();
  for (const line of table.stdout.split('\n')) {
    const [child, parent] = line.trim().split(/\s+/).map(Number);
    if (Number.isInteger(child) && Number.isInteger(parent)) {
      children.set(parent, [...(children.get(parent) ?? []), child]);
    }
  }

  const found: number[] = [];
  for (const queue = [pid]; queue.length > 0;) {
    for (const child of children.get(queue.shift() ?? 0) ?? []) {
      found.push(child);
      queue.push(child);
    }
  }

  return found;
};

const quietly = (pid: number): void => {
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Already gone.
  }
};

/**
 * Stops `child` and everything under it: its process group when it was spawned with `TREE`; on Windows, its tree; and
 * otherwise each process it started, then itself — a shell that runs its command as a child (Linux's `sh`) left the
 * server listening once the shell alone was stopped. Gone already: nothing.
 */
export const stopTree = (child: ChildProcess, { group = false }: { group?: boolean } = {}): void => {
  const { pid } = child;
  if (pid === undefined) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else if (group) {
    quietly(-pid);
  } else {
    descendantsOf(pid).reverse().forEach(quietly);
    quietly(pid);
  }
};

/** What `lsof -F` says of each process, by its field letter: `p` its pid, `n` a name (an address, a folder). */
const lsofFields = (args: readonly string[]): { pid: number; names: string[] }[] => {
  const read = spawnSync('lsof', [...args], { encoding: 'utf-8' });
  const found: { pid: number; names: string[] }[] = [];
  for (const line of (read.stdout as string | null)?.split('\n') ?? []) {
    if (line.startsWith('p')) {
      found.push({ pid: Number(line.slice(1)), names: [] });
    } else if (line.startsWith('n')) {
      found.at(-1)?.names.push(line.slice(1));
    }
  }

  return found;
};

/**
 * The servers listening from inside `dir` — what an agent started in a task's copy (`npm start`) and left running: a
 * run's copies removed under them (velada-fidelity's finish), they listened on with no folder, no one's to stop. Read
 * off `lsof`: nothing where there is none (Windows).
 */
export const listenersUnder = (dir: string): { pid: number; port: number; cwd: string }[] => {
  if (process.platform === 'win32') {
    return [];
  }

  return lsofFields(['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn']).flatMap(({ pid, names }) => {
    const port = Number(names.at(0)?.split(':').at(-1));
    const cwd = lsofFields(['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
      .at(0)
      ?.names.at(0);

    return Number.isInteger(port) && cwd !== undefined && (cwd === dir || cwd.startsWith(`${dir}/`))
      ? [{ pid, port, cwd }]
      : [];
  });
};

/** Stops one listening process and what it started — never by its name, which another process may carry. */
export const stopListener = (pid: number): void => {
  descendantsOf(pid).forEach(quietly);
  quietly(pid);
};

/** Stops each server listening from inside `dir`, and what it started: said back as what was stopped. */
export const stopListenersUnder = (dir: string): { pid: number; port: number; cwd: string }[] => {
  const listening = listenersUnder(dir);
  for (const { pid } of listening) {
    stopListener(pid);
  }

  return listening;
};
