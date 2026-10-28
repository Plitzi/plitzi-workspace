import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { RUNS_DIR } from './paths';
import { RunRefusal } from './refusal';
import { projectDlx } from '../../scaffold/packageManager';

/**
 * A run's files are written by one CLI and may be read by another — an upgrade while it is open. Every change to what a
 * file holds is additive (an optional field), so a newer CLI reads an older one's run; `src/tests/runRecords/` keeps one
 * of each as an older CLI wrote it, and `runs-compat.test.ts` reads them. When one is not read all the same — a change
 * that could not be additive, or a downgrade — it is said as that, with the CLI that wrote it, never as a hand edit.
 */

/** The CLI a run was opened with, as its record says — read raw, as a record this CLI cannot read still says it. */
const pinnedCli = async (root: string, runId: string): Promise<string | undefined> => {
  const raw: unknown = await fs
    .readFile(path.join(root, ...RUNS_DIR.split('/'), runId, 'run.json'), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);

  return isRecord(raw) && isRecord(raw.pinned) && typeof raw.pinned.cli === 'string' ? raw.pinned.cli : undefined;
};

/**
 * A refusal to read a file of a run that another CLI wrote, said as that: which one, and how to go on with it. Any other
 * refusal is left as it is (undefined).
 */
export const writtenByAnother = async (
  error: RunRefusal,
  root: string,
  cli: string
): Promise<RunRefusal | undefined> => {
  const { file } = error.detail;
  if (error.code !== 'invalid' || typeof file !== 'string') {
    return undefined;
  }

  const relative = path.relative(path.join(root, ...RUNS_DIR.split('/')), file);
  const [runId] = relative.split(path.sep);
  if (relative.startsWith('..') || path.isAbsolute(relative) || runId === '') {
    return undefined;
  }

  const was = await pinnedCli(root, runId);
  if (was === undefined || was === cli) {
    return undefined;
  }

  return new RunRefusal(
    'version-mismatch',
    `${path.relative(root, file)} was written by @plitzi/cli ${was}, and this one (${cli}) does not read it: go on with the CLI that opened the run until it is finished — ${projectDlx(`@plitzi/cli@${was} run status ${runId}`)} — or a person aborts it (plitzi run abort ${runId}): the project is as it was`,
    { file, run: runId, next: projectDlx(`@plitzi/cli@${was} run status ${runId}`) }
  );
};
