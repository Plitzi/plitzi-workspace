import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

/**
 * What the CLI last wrote of a project's machinery (`machineryFiles`): a digest of each file as it was written, never
 * the file — as `.plitzi/space.json` keeps of what a pull wrote. Enough for `plitzi upgrade` to tell a file nobody
 * touched since, which it may replace, from one somebody made their own, which it only shows.
 *
 * Kept where the CLI keeps its other state. A project without one — made before it existed, or a clone that did not
 * carry it — is not refused anything: every file that differs is then shown as the project's, for its author to take.
 */
export const SCAFFOLD_RECORD_FILE = path.join('.plitzi', 'scaffold.json');

export interface ScaffoldRecord {
  format: 1;
  /** The CLI that wrote them, as `@plitzi/cli`'s version. */
  cli: string;
  /** File → the sha256 of what was written. */
  files: Record<string, string>;
}

export const digestOf = (contents: string): string => createHash('sha256').update(contents).digest('hex');

export const readScaffoldRecord = async (root: string): Promise<ScaffoldRecord | undefined> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(path.join(root, SCAFFOLD_RECORD_FILE), 'utf-8'));
  } catch {
    return undefined;
  }

  if (!isRecord(parsed) || parsed.format !== 1 || typeof parsed.cli !== 'string' || !isRecord(parsed.files)) {
    return undefined;
  }

  const files = Object.fromEntries(
    Object.entries(parsed.files).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );

  return { format: 1, cli: parsed.cli, files };
};

/** What the CLI wrote, file → its digest (`digestOf`), as `cli` wrote it. */
export const writeScaffoldRecord = async (
  root: string,
  cli: string,
  digests: Record<string, string>
): Promise<void> => {
  const record: ScaffoldRecord = {
    format: 1,
    cli,
    files: Object.fromEntries(Object.entries(digests).sort(([a], [b]) => a.localeCompare(b)))
  };
  await fs.mkdir(path.join(root, '.plitzi'), { recursive: true });
  await fs.writeFile(path.join(root, SCAFFOLD_RECORD_FILE), `${JSON.stringify(record, null, 2)}\n`);
};
