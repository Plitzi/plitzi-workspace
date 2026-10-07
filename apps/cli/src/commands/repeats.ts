import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { PROJECT_TMP } from '@plitzi/sdk-shared/project/paths';

/**
 * The same command refused again in the same project — an agent going round in circles, which a model is not trusted
 * to notice. Kept in the project's `tmp/` (never committed), a short while: a hint, never a lock.
 */

const FILE = path.join(PROJECT_TMP, 'refusals.json');

const WINDOW_MS = 10 * 60 * 1000;

type Refusals = Record<string, { count: number; at: number }>;

const read = async (root: string, now: number): Promise<Refusals> => {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(path.join(root, FILE), 'utf-8'));
    if (!isRecord(parsed)) {
      return {};
    }

    const kept: Refusals = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (
        isRecord(entry) &&
        typeof entry.count === 'number' &&
        typeof entry.at === 'number' &&
        now - entry.at < WINDOW_MS
      ) {
        kept[key] = { count: entry.count, at: entry.at };
      }
    }

    return kept;
  } catch {
    return {};
  }
};

/** This command refused once more: how many times it was before, lately. */
export const noteRefused = async (root: string, command: readonly string[], now = Date.now()): Promise<number> => {
  const key = createHash('sha256').update(JSON.stringify(command)).digest('hex').slice(0, 16);
  const refusals = await read(root, now);
  const before = key in refusals ? refusals[key].count : 0;
  refusals[key] = { count: before + 1, at: now };
  await fs.mkdir(path.join(root, PROJECT_TMP), { recursive: true });
  await fs.writeFile(path.join(root, FILE), JSON.stringify(refusals));

  return before;
};

export const AGAIN =
  'This is the same command refused again: running it once more will not change the answer. Change what it names, ' +
  'edit the call by hand (`plitzi element where` shows it), or ask the person what they meant.';
