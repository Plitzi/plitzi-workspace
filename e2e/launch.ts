import { execFileSync, spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

import { LAUNCH_TARGETS_ENV, LAUNCHER_PORT } from './launchConfig';
import { target } from './targets';

import type { Target } from './targets';
import type { ChildProcess } from 'node:child_process';

/** Every server a run needs, started at once — the one `webServer` Playwright is given.
 *
 *  Playwright starts the servers of a `webServer` list one after another, each waiting for the last to listen: with
 *  twenty-six of them, the first spec waited fifty seconds, the sum of every boot. Started together, the wait is the
 *  slowest boot alone. This process is the one Playwright starts, watches and stops; it says it is ready on its own
 *  port once every server it started listens, and takes them all down with it.
 *
 *  A port that already answers is reused while developing — a server left running from an earlier run, or a dev
 *  server of yours — but only when it is this repository's: one running from another folder is refused with its
 *  folder and pid, rather than tested as if it were the app (a stranger on the builder's port failed its specs on a
 *  thirty-second timeout each, with a screenshot of somebody else's site). */

const isCI = !!process.env.CI;
const showServerLogs = !!process.env.E2E_SERVER_LOGS;
const BOOT_TIMEOUT_MS = 180_000;
const REPO = realpathSync(path.resolve(import.meta.dirname, '..'));

const portOf = (candidate: Target): number => Number(new URL(candidate.origin).port);

const answers = (port: number): Promise<boolean> =>
  new Promise(resolve => {
    // Both loopbacks: Vite binds the name `localhost`, which macOS resolves to ::1 first.
    const tryHost = (hosts: string[]): void => {
      const [host, ...rest] = hosts;
      if (!host) {
        resolve(false);

        return;
      }

      const socket = net.connect({ host, port });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => {
        socket.destroy();
        tryHost(rest);
      });
    };
    tryHost(['127.0.0.1', '::1']);
  });

/** The folder the process listening on `port` runs in, or undefined when the platform cannot say. */
const listenerFolder = (port: number): { pid: string; folder?: string } | undefined => {
  try {
    const pid = execFileSync('lsof', ['-ti', `tcp:${String(port)}`, '-sTCP:LISTEN'], { encoding: 'utf-8' })
      .trim()
      .split('\n')[0];
    if (!pid) {
      return undefined;
    }

    const cwd = execFileSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf-8' })
      .split('\n')
      .find(line => line.startsWith('n'))
      ?.slice(1);

    return { pid, folder: cwd ? realpathSync(cwd) : undefined };
  } catch {
    return undefined;
  }
};

const children: ChildProcess[] = [];

const stopAll = (): void => {
  for (const child of children) {
    if (child.pid && child.exitCode === null) {
      try {
        // The whole group: `yarn workspace … start` is a shell, a yarn and the server under them.
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // Already gone.
      }
    }
  }
};

/** Starts one server, or reuses the one already there; resolves once it listens. */
const bring = async (candidate: Target): Promise<'started' | 'reused'> => {
  const port = portOf(candidate);
  if (await answers(port)) {
    if (isCI) {
      throw new Error(`${candidate.id}: port ${String(port)} is already taken — a CI run starts every server itself`);
    }

    const listener = listenerFolder(port);
    if (listener?.folder && !listener.folder.startsWith(REPO)) {
      throw new Error(
        `${candidate.id}: port ${String(port)} is held by a server running in ${listener.folder} (pid ${listener.pid}), ` +
          `not by this repository — stop it, and the run starts ${candidate.id} itself`
      );
    }

    return 'reused';
  }

  const child = spawn(candidate.command ?? `yarn workspace ${candidate.workspace} start`, {
    shell: true,
    detached: true,
    stdio: ['ignore', showServerLogs ? 'inherit' : 'ignore', 'pipe']
  });
  children.push(child);
  const said: string[] = [];
  child.stderr.on('data', (chunk: Buffer) => {
    said.push(chunk.toString());
    process.stderr.write(`[${candidate.id}] ${chunk.toString()}`);
  });

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${candidate.id} exited while starting:\n${said.join('').slice(-2000)}`);
    }

    if (await answers(port)) {
      return 'started';
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  throw new Error(`${candidate.id} did not listen on ${String(port)} within ${String(BOOT_TIMEOUT_MS / 1000)}s`);
};

const main = async (): Promise<void> => {
  const ids = (process.env[LAUNCH_TARGETS_ENV] ?? '').split(',').filter(Boolean);
  const started = Date.now();
  const outcomes = await Promise.allSettled(ids.map(id => bring(target(id))));
  const failures = outcomes.flatMap(outcome => (outcome.status === 'rejected' ? [String(outcome.reason)] : []));
  if (failures.length > 0) {
    console.error(`[e2e] could not start every server:\n  ${failures.join('\n  ')}`);
    stopAll();
    process.exit(1);
  }

  const reused = ids.filter((_, index) => {
    const outcome = outcomes[index];

    return outcome.status === 'fulfilled' && outcome.value === 'reused';
  });
  console.error(
    `[e2e] ${String(ids.length)} server(s) up in ${((Date.now() - started) / 1000).toFixed(1)}s` +
      (reused.length > 0 ? ` (already running: ${reused.join(', ')})` : '')
  );

  http.createServer((_, res) => res.end('ready')).listen(LAUNCHER_PORT, '127.0.0.1');
};

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.once(signal, () => {
    stopAll();
    process.exit(0);
  });
}

process.once('exit', stopAll);

await main();
