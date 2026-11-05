import { spawn } from 'node:child_process';
import path from 'node:path';

import { actionsOrigin } from './addresses.ts';

import type { ChildProcess } from 'node:child_process';

/**
 * All of it on this machine, each part a process of its own — as each would be on a machine of its own: the worker,
 * the page server and, when both are on one origin, the gateway in front. `--elsewhere` puts the worker on its own
 * origin instead, and there is no gateway. Each starts once the one behind it listens, so nothing takes a visitor
 * before what answers them is up; one that stops stops the rest, and says which.
 */
const parts = ['worker.ts', 'pages.ts', ...(actionsOrigin ? [] : ['gateway.ts'])];
const env = { ...process.env, ...(actionsOrigin ? { ACTIONS_ORIGIN: actionsOrigin } : {}) };
const children: ChildProcess[] = [];

let stopping = false;
const stop = (code: number) => {
  stopping = true;
  children.forEach(child => child.kill('SIGTERM'));
  process.exitCode = code;
};

/** Resolves once the part listens, or at once when the example is stopping: nothing more is started then. */
const start = (part: string): Promise<void> =>
  new Promise(resolve => {
    if (stopping) {
      resolve();

      return;
    }

    const child = spawn(process.execPath, [path.join(import.meta.dirname, part)], {
      env,
      stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    });
    children.push(child);
    child.once('message', () => {
      resolve();
    });
    child.on('exit', code => {
      resolve();
      if (!stopping) {
        console.error(`[example] ${part} stopped (${String(code)}): stopping the rest`);
        stop(code ?? 1);
      }
    });
  });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    stop(0);
  });
}

for (const part of parts) {
  await start(part);
}
