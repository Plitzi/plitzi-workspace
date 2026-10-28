import { spawn } from 'node:child_process';
import path from 'node:path';

import { childrenTable, foldersOf, listeningPorts } from './processTable';

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
 * Every process under `pid`, read off the system's process table (`ps`, else `/proc`): what a shell started, and what
 * that started. Nothing where the machine says neither.
 */
export const descendantsOf = (pid: number): number[] => {
  const children = childrenTable();
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

/**
 * The servers listening from inside `dir` — what an agent started in a task's copy (`npm start`) and left running: a
 * run's copies removed under them (a run's finish), they listened on with no folder, no one's to stop. None where the
 * machine does not say a process's folder (`foldersUnsaid`).
 */
export const listenersUnder = (dir: string): { pid: number; port: number; cwd: string }[] => {
  const listening = listeningPorts();
  const cwds = foldersOf(listening.map(each => each.pid));

  return listening.flatMap(({ pid, port }) => {
    const cwd = cwds.get(pid);

    return cwd !== undefined && (cwd === dir || cwd.startsWith(`${dir}${path.sep}`)) ? [{ pid, port, cwd }] : [];
  });
};

/** Whatever listens on `port`, and the folder it was started in when the machine says it — or nothing when none does. */
export const listenerOn = (port: number): { pid: number; cwd: string | undefined } | undefined => {
  const found = listeningPorts().find(each => each.port === port);

  return found === undefined ? undefined : { pid: found.pid, cwd: foldersOf([found.pid]).get(found.pid) };
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

/** How often a guard looks whether the command that started a server is still there. */
const GUARD_EVERY_MS = 2000;

/**
 * A guard for a server in a process group of its own (`TREE`), started for one command: it stops the group once that
 * command's process is gone — ended by a harness's timeout, a Ctrl-C, a crash — and leaves once the server is. Six
 * test servers outlived their runs for days, and a `task check` cut short left the copy's server holding its state.
 * `release` once the server is kept past the command (the keeper's watchdog takes it), or stopped by the command.
 */
export const guardServer = (
  pid: number | undefined,
  /** The command it is stopped with: this one. */
  parent: number = process.pid
): { release: () => void } => {
  if (pid === undefined || process.platform === 'win32') {
    return { release: () => undefined };
  }

  const guard = spawn(
    process.execPath,
    [
      '-e',
      `const [parent, pid] = process.argv.slice(1).map(Number);
setInterval(() => {
  try { process.kill(pid, 0); } catch { process.exit(0); }
  try { process.kill(parent, 0); } catch { try { process.kill(-pid, 'SIGTERM'); } catch {} process.exit(0); }
}, ${String(GUARD_EVERY_MS)});`,
      String(parent),
      String(pid)
    ],
    { detached: true, stdio: 'ignore' }
  );
  guard.unref();

  return {
    release: () => {
      guard.kill();
    }
  };
};
