import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readJson } from './files';

import type { RunPaths } from './paths';
import type { LoadedRun } from './run';

/** Where a run's preview says it serves — its process and port — while it runs (`plitzi run preview`). */
export const previewRecord = (paths: RunPaths): string => path.join(paths.cache, 'preview.json');

export const isPreview = (value: unknown): value is { pid: number; port: number } =>
  isRecord(value) && typeof value.pid === 'number' && typeof value.port === 'number';

export const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch {
    return false;
  }
};

/** The port of the run's preview while one serves it — none running, undefined. */
export const previewPort = async (loaded: LoadedRun): Promise<number | undefined> => {
  const running = await readJson(previewRecord(loaded.paths), isPreview, 'a run’s preview').catch(() => undefined);

  return running && alive(running.pid) ? running.port : undefined;
};

/** How long a run's removal waits for its preview to stop: it looks for its run every two seconds. */
const PREVIEW_STOP_MS = 10_000;

/**
 * A run's preview stopped before its folder goes: its record removed first, which the preview reads as "the run ended"
 * and stops its server on — then waited for. Its folder removed under it instead, the server restarted by its own watch
 * in a folder that no longer exists, and crashed (`uv_cwd`) before the preview saw the run end (a run's finish).
 */
export const stopPreviewOf = async (paths: RunPaths): Promise<void> => {
  const running = await readJson(previewRecord(paths), isPreview, 'a run’s preview').catch(() => undefined);
  if (!running || !alive(running.pid) || running.pid === process.pid) {
    return;
  }

  await fs.rm(paths.record, { force: true });
  const until = Date.now() + PREVIEW_STOP_MS;
  while (alive(running.pid) && Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
};

/**
 * The run's preview another process serves — `npm run start:preview`, another monitor — stopped as its own Ctrl-C stops
 * it (SIGINT), and waited for until its record is gone. Which process it was, and whether it stopped in time; none
 * serving it, undefined.
 */
export const stopServedPreview = async (paths: RunPaths): Promise<{ pid: number; stopped: boolean } | undefined> => {
  const read = () => readJson(previewRecord(paths), isPreview, 'a run’s preview').catch(() => undefined);
  const running = await read();
  if (!running || !alive(running.pid) || running.pid === process.pid) {
    return undefined;
  }

  process.kill(running.pid, 'SIGINT');
  const until = Date.now() + PREVIEW_STOP_MS;
  // A monitor that served it lives on once it stopped: its record going is the preview gone.
  const serving = async () => alive(running.pid) && (await read())?.pid === running.pid;
  while ((await serving()) && Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { pid: running.pid, stopped: !(await serving()) };
};
