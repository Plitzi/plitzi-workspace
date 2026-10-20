import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { readJson } from './files';

import type { LoadedRun } from './run';

/** Where a run's preview says it serves — its process and port — while it runs (`plitzi run preview`). */
export const previewRecord = (loaded: LoadedRun): string => path.join(loaded.paths.cache, 'preview.json');

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
  const running = await readJson(previewRecord(loaded), isPreview, 'a run’s preview').catch(() => undefined);

  return running && alive(running.pid) ? running.port : undefined;
};
