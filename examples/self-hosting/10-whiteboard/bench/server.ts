import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChildProcess } from 'node:child_process';

/**
 * Pizarra, started for the bench: the page server as it ships — `NODE_ENV=production`, so the page loads React's
 * production build (the development one renders about twice as slowly, which is not what anybody draws on) — on a
 * port of its own, with the in-memory store, so a run starts from nothing and leaves nothing behind.
 *
 * In a directory of its own, too: the page server keeps its compiled plugins in `.sdk-plugins` under the working
 * directory, and a run that shares one with the development server shares its builds. Each run compiles its own and
 * leaves nothing behind.
 */

const MAIN = fileURLToPath(new URL('../src/main.ts', import.meta.url));

export type BenchServer = { origin: string; stop: () => Promise<void> };

const ready = async (origin: string, child: ChildProcess): Promise<void> => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Pizarra exited with ${child.exitCode} before it answered`);
    }

    try {
      const response = await fetch(origin);
      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`Pizarra did not answer on ${origin} within 30 seconds`);
};

export const startServer = async (port: number): Promise<BenchServer> => {
  const origin = `http://127.0.0.1:${port}`;
  const cwd = mkdtempSync(path.join(tmpdir(), 'pizarra-bench-'));
  const child = spawn(process.execPath, [MAIN], {
    cwd,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production', REDIS_URL: '' },
    stdio: ['ignore', 'ignore', 'pipe']
  });
  const forget = () => rmSync(cwd, { recursive: true, force: true });
  let errors = '';
  child.stderr.on('data', (chunk: Buffer) => {
    errors = `${errors}${chunk.toString()}`.slice(-4000);
  });

  try {
    await ready(origin, child);
  } catch (error) {
    child.kill();
    forget();
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${errors}`, { cause: error });
  }

  return {
    origin,
    stop: () =>
      new Promise(resolve => {
        if (child.exitCode !== null) {
          forget();
          resolve();

          return;
        }

        child.once('exit', () => {
          forget();
          resolve();
        });
        child.kill('SIGTERM');
      })
  };
};
