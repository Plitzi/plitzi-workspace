import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Where a project `plitzi create --from` made came from, and what the space gave it: `.plitzi/space.json`, committed
 * with the project so everyone working on it pulls from the same point.
 *
 * What it was given is kept as a digest of each file as it was written, never the file: that is enough for `plitzi
 * pull` to tell a file changed here from one the space changed — the two questions a pull asks of every file — and a
 * copy of the whole project beside the project would be the second source of it nobody keeps in step.
 */

export const ORIGIN_FILE = path.join('.plitzi', 'space.json');

export type SpaceOrigin = {
  format: 1;
  /** The platform the space is on. */
  api: string;
  space: { id: number; name: string; permanentUrl: string };
  /** Whether the pages are in the project (`local`) or read from Plitzi (`cloud`). */
  source: 'local' | 'cloud';
  /** Every file the space gave the project, by path: the sha256 of what was written. */
  files: Record<string, string>;
  /** The files fetched from the space's CDN, by path: the address each one was fetched from. */
  downloads: Record<string, string>;
  /** The packages the space's code asked for, at the ranges written into `package.json`. */
  dependencies: Record<string, string>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStrings = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every(entry => typeof entry === 'string');

export const digest = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');

/** The digest of a file as it is on disk, or `undefined` when there is none. */
export const digestOnDisk = async (root: string, file: string): Promise<string | undefined> => {
  try {
    return digest(await fs.readFile(path.join(root, file)));
  } catch {
    return undefined;
  }
};

/** The project's origin, or `undefined` when it has none — it was not made from a space, or the file is not one. */
export const readOrigin = async (root: string): Promise<SpaceOrigin | undefined> => {
  try {
    const value: unknown = JSON.parse(await fs.readFile(path.join(root, ORIGIN_FILE), 'utf-8'));
    if (
      !isRecord(value) ||
      value.format !== 1 ||
      typeof value.api !== 'string' ||
      !isRecord(value.space) ||
      typeof value.space.id !== 'number' ||
      typeof value.space.name !== 'string' ||
      typeof value.space.permanentUrl !== 'string' ||
      (value.source !== 'local' && value.source !== 'cloud') ||
      !isStrings(value.files) ||
      !isStrings(value.downloads) ||
      !isStrings(value.dependencies)
    ) {
      return undefined;
    }

    return {
      format: 1,
      api: value.api,
      space: { id: value.space.id, name: value.space.name, permanentUrl: value.space.permanentUrl },
      source: value.source,
      files: value.files,
      downloads: value.downloads,
      dependencies: value.dependencies
    };
  } catch {
    return undefined;
  }
};

/** Kept sorted, so a pull that changed one file changes one line of it. */
const sorted = (record: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));

export const writeOrigin = async (root: string, origin: SpaceOrigin): Promise<void> => {
  await fs.mkdir(path.join(root, '.plitzi'), { recursive: true });
  await fs.writeFile(
    path.join(root, ORIGIN_FILE),
    `${JSON.stringify(
      {
        ...origin,
        files: sorted(origin.files),
        downloads: sorted(origin.downloads),
        dependencies: sorted(origin.dependencies)
      },
      null,
      2
    )}\n`
  );
};

/** The digest of each of these files as it is on disk now: what the project was given, once it is written. */
export const digestsOnDisk = async (root: string, files: readonly string[]): Promise<Record<string, string>> => {
  const digests = await Promise.all(files.map(async file => [file, await digestOnDisk(root, file)] as const));

  return Object.fromEntries(digests.filter((entry): entry is [string, string] => entry[1] !== undefined));
};
