import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { projectMark } from '@plitzi/sdk-shared/project';

/**
 * A copy's server kept a while after the command that served it: an agent pictures its page again and again, and each
 * `page shot` started the copy's server and stopped it (seconds each, velada-dress's agents shot hundreds). Kept for
 * `LINGER_MS` past its last use, by a watchdog of its own that stops it then — or once the copy is gone — and stopped
 * at once by whatever serves the copy itself (`complete`, `task check`): two servers on one copy fight over its state.
 * Where processes are not a group to stop together (Windows), nothing is kept.
 */

/** How long a copy's server is kept with nothing asked of it. */
export const LINGER_MS = 3 * 60_000;

interface Kept {
  pid: number;
  port: number;
  usedAt: string;
  /** The newest write under the copy's `src/` when it was served: one after it, and it serves what was. */
  newest: number;
}

/** The newest write under the copy's `src/`, in ms: what a server started before it does not serve. */
export const newestWrite = async (work: string): Promise<number> => {
  const entries = await fs.readdir(path.join(work, 'src'), { recursive: true, withFileTypes: true }).catch(() => []);
  const times = await Promise.all(
    entries
      .filter(entry => entry.isFile())
      .map(entry =>
        fs
          .stat(path.join(entry.parentPath, entry.name))
          .then(stat => stat.mtimeMs)
          .catch(() => 0)
      )
  );

  return Math.max(0, ...times);
};

const fileOf = (cache: string): string => path.join(cache, 'served.json');

const isKept = (value: unknown): value is Kept =>
  isRecord(value) &&
  typeof value.pid === 'number' &&
  typeof value.port === 'number' &&
  typeof value.usedAt === 'string' &&
  typeof value.newest === 'number';

const readKept = async (cache: string): Promise<Kept | undefined> => {
  const value: unknown = await fs
    .readFile(fileOf(cache), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);

  return isKept(value) ? value : undefined;
};

/** The port of the copy's server the CLI keeps between commands — none when it keeps none. */
export const keptPort = async (cache: string): Promise<number | undefined> => (await readKept(cache))?.port;

/** Whether a group of processes is one to keep and stop later: not on Windows, where a child is not its own group. */
export const canLinger = (): boolean => process.platform !== 'win32';

/** The copy's server kept, answering as this copy's: its address, its use marked now — or none. */
export const keptServer = async (work: string, cache: string): Promise<string | undefined> => {
  const kept = await readKept(cache);
  if (!kept) {
    return undefined;
  }

  // Written since it was served: it serves what was — stopped, and the copy served as it is now.
  if ((await newestWrite(work)) > kept.newest) {
    await stopKept(cache);

    return undefined;
  }

  const health: unknown = await fetch(`http://127.0.0.1:${String(kept.port)}/health`, {
    signal: AbortSignal.timeout(1_000)
  })
    .then(async (response): Promise<unknown> => response.json())
    .catch(() => undefined);
  const ours = isRecord(health) && (typeof health.Instance !== 'string' || health.Instance === projectMark(work));
  if (!ours) {
    await fs.rm(fileOf(cache), { force: true });

    return undefined;
  }

  await fs.writeFile(fileOf(cache), JSON.stringify({ ...kept, usedAt: new Date().toISOString() }));

  return `http://127.0.0.1:${String(kept.port)}`;
};

/** Keeps the copy's server `pid` on `port` past this command, and starts the watchdog that stops it once unused. */
export const keepServer = async (work: string, cache: string, pid: number, port: number): Promise<void> => {
  await fs.writeFile(
    fileOf(cache),
    JSON.stringify({ pid, port, usedAt: new Date().toISOString(), newest: await newestWrite(work) } satisfies Kept)
  );
  // Its own process, apart from this one: it outlives the command, reading the record, and stops the server's group.
  const watchdog = `
const fs = require('node:fs');
const [file, work, pid, linger] = process.argv.slice(1);
const stop = () => { try { process.kill(-Number(pid), 'SIGTERM'); } catch {} try { fs.rmSync(file, { force: true }); } catch {} process.exit(0); };
setInterval(() => {
  let kept;
  // Its record gone, its run went with it (a finish removes the folder): the server stops; one read mid-write, next tick.
  try { kept = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { if (!fs.existsSync(file)) { stop(); } return; }
  if (kept.pid !== Number(pid)) { process.exit(0); }
  try { process.kill(Number(pid), 0); } catch { try { fs.rmSync(file, { force: true }); } catch {} process.exit(0); }
  if (!fs.existsSync(work) || Date.now() - Date.parse(kept.usedAt) > Number(linger)) { stop(); }
}, 10000);
`;
  spawn(process.execPath, ['-e', watchdog, fileOf(cache), work, String(pid), String(LINGER_MS)], {
    detached: true,
    stdio: 'ignore'
  }).unref();
};

/**
 * Stops the copy's server kept, if one is — before the copy is served by a command that serves it itself — and waits,
 * a few seconds at most, until it no longer answers: met answering, it reads as a server of the agent's own.
 */
export const stopKept = async (cache: string): Promise<void> => {
  const kept = await readKept(cache);
  if (!kept) {
    return;
  }

  try {
    process.kill(-kept.pid, 'SIGTERM');
  } catch {
    // Gone already: its record is all there is to remove.
  }

  await fs.rm(fileOf(cache), { force: true });
  for (let tries = 0; tries < 20; tries += 1) {
    const answers = await fetch(`http://127.0.0.1:${String(kept.port)}/health`, { signal: AbortSignal.timeout(500) })
      .then(() => true)
      .catch(() => false);
    if (!answers) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }
};

/** The kept server's use marked now, while a command borrows it: its watchdog stops it only once nobody does. */
export const touchKept = async (cache: string, port: number): Promise<void> => {
  const kept = await readKept(cache);
  if (kept?.port === port) {
    await fs.writeFile(fileOf(cache), JSON.stringify({ ...kept, usedAt: new Date().toISOString() }));
  }
};

const previewedFile = (cache: string): string => path.join(cache, 'previewed.json');

/**
 * A copy served by a preview (`task look`, `run preview --task`), said where a picture asks for the copy's server: one
 * started beside it holds the copy's state (its kv) against the other's, and one of them fails — velada-polish's lead
 * look pictured nothing.
 */
export const markPreviewed = (cache: string, port: number): Promise<void> =>
  fs.writeFile(previewedFile(cache), JSON.stringify({ port, pid: process.pid }));

export const unmarkPreviewed = (cache: string): Promise<void> => fs.rm(previewedFile(cache), { force: true });

/** The copy's preview, answering as this copy's: its address — or none. */
export const previewedServer = async (work: string, cache: string): Promise<string | undefined> => {
  const value: unknown = await fs
    .readFile(previewedFile(cache), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);
  if (!isRecord(value) || typeof value.port !== 'number') {
    return undefined;
  }

  const health: unknown = await fetch(`http://127.0.0.1:${String(value.port)}/health`, {
    signal: AbortSignal.timeout(1_000)
  })
    .then(async (response): Promise<unknown> => response.json())
    .catch(() => undefined);

  return isRecord(health) && (typeof health.Instance !== 'string' || health.Instance === projectMark(work))
    ? `http://127.0.0.1:${String(value.port)}`
    : undefined;
};
