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
  /**
   * `package.json`'s scripts as the CLI wrote them, name → command: a script still saying that is the CLI's to bring up
   * to date, one that says something else is the project's. Absent in a record from before scripts were kept.
   */
  scripts?: Record<string, string>;
}

const stringRecord = (value: unknown): Record<string, string> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      )
    : {};

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

  return {
    format: 1,
    cli: parsed.cli,
    files: stringRecord(parsed.files),
    ...(isRecord(parsed.scripts) ? { scripts: stringRecord(parsed.scripts) } : {})
  };
};

/** The scripts of a `package.json`'s text: none when it has none, or is not one. */
export const scriptsOf = (packageJsonText: string | undefined): Record<string, string> => {
  try {
    const parsed: unknown = JSON.parse(packageJsonText ?? '');

    return isRecord(parsed) ? stringRecord(parsed.scripts) : {};
  } catch {
    return {};
  }
};

const sorted = (entries: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));

/**
 * What the CLI wrote, as `cli` wrote it: its files (file → digest, `digestOf`) and its scripts. A part not given keeps
 * what was recorded — `upgrade packages` alone leaves the files' record as it found it.
 */
export const writeScaffoldRecord = async (
  root: string,
  cli: string,
  { files, scripts }: { files?: Record<string, string>; scripts?: Record<string, string> }
): Promise<void> => {
  const previous = await readScaffoldRecord(root);
  const keptScripts = scripts ?? previous?.scripts;
  const record: ScaffoldRecord = {
    format: 1,
    cli,
    files: sorted(files ?? previous?.files ?? {}),
    ...(keptScripts ? { scripts: sorted(keptScripts) } : {})
  };
  await fs.mkdir(path.join(root, '.plitzi'), { recursive: true });
  await fs.writeFile(path.join(root, SCAFFOLD_RECORD_FILE), `${JSON.stringify(record, null, 2)}\n`);
};
