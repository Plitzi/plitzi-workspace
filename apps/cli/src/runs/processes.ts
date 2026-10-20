import { spawn } from 'node:child_process';

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
 * Stops `child` and everything under it: its process group when it was spawned with `TREE`, or on Windows — where
 * killing the shell leaves the server it started, and there are no groups — its tree. Gone already: nothing.
 */
export const stopTree = (child: ChildProcess, { group = false }: { group?: boolean } = {}): void => {
  try {
    if (child.pid === undefined) {
      return;
    }

    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else if (group) {
      process.kill(-child.pid, 'SIGTERM');
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    // Already gone.
  }
};
