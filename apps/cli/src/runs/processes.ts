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
