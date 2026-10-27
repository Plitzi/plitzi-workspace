import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { CLI_VERSION } from '../../scaffold/project';
import { fingerprint, writeJson } from '../core/files';
import { under } from '../core/paths';
import { readApproved } from '../run';
import { digestsOf } from './approve';

import type { CheckResult } from '../copies/checks';
import type { AcceptanceResult, RunTask } from '../core/model';
import type { TaskPaths } from '../core/paths';
import type { LoadedRun } from '../run';

/**
 * What a passing `task check` proved, kept for `task complete`: the same checks, on the same files, the run the same —
 * not run again. An agent checks, then completes at once, and every complete ran author, lint, typecheck, format and the
 * acceptance a second time for nothing (the sanity run: 9 s, then 9 s again). Held by a key — the task's files as they
 * are, the run's approved work, the acceptance, the CLI — and for a while: anything else changed, the checks run.
 */

/** How long a passing check stands for a complete with nothing changed. */
export const CHECKED_FOR_MS = 30 * 60_000;

interface Checked {
  at: string;
  key: string;
  checks: CheckResult;
  accepted: AcceptanceResult[];
}

const isChecked = (value: unknown): value is Checked =>
  isRecord(value) &&
  typeof value.at === 'string' &&
  typeof value.key === 'string' &&
  isRecord(value.checks) &&
  Array.isArray(value.accepted);

const checkedFile = (paths: TaskPaths): string => path.join(paths.cache, 'checked.json');

/** What the checks of a task's copy depend on, as one digest: its changed files, the run's approved work, its ask. */
export const checkKey = async (
  loaded: LoadedRun,
  paths: TaskPaths,
  task: Pick<RunTask, 'acceptance'>,
  changed: readonly string[]
): Promise<string> => {
  const files = await Promise.all(
    [...changed].sort().map(async file => [file, await fingerprint(under(paths.work, file))] as const)
  );
  const approved = digestsOf(await readApproved(loaded.paths));

  return createHash('sha256')
    .update(JSON.stringify({ files, approved, acceptance: task.acceptance, cli: CLI_VERSION }))
    .digest('hex');
};

/** A passing check, kept under its key. */
export const keepChecked = (
  paths: TaskPaths,
  key: string,
  passed: { checks: CheckResult; accepted: AcceptanceResult[] },
  now: Date
): Promise<void> => writeJson(checkedFile(paths), { at: now.toISOString(), key, ...passed } satisfies Checked);

/** The passing check that still stands for `key`: none past its time, under another key, or never kept. */
export const checkedStill = async (paths: TaskPaths, key: string, now: Date): Promise<Checked | undefined> => {
  const read: unknown = await fs
    .readFile(checkedFile(paths), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);

  return isChecked(read) && read.key === key && now.getTime() - Date.parse(read.at) < CHECKED_FOR_MS ? read : undefined;
};
