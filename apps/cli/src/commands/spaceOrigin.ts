import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { isTextFile } from '../scaffold/fromSpace';

import type { Formatter } from './projectFormatter';
import type { ProjectFromSpace } from '../scaffold/fromSpace';

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
  /**
   * Which version of the space it follows: the draft (`main`), or a published environment — its latest, or the
   * revision named when one was (`create --revision`, `pull --revision`).
   */
  version: { environment: string; revision?: number };
  /**
   * The draft the project was last given or last pushed (`SpaceExport.draft`): what `plitzi push` names as its base,
   * so a draft edited in the builder since is never replaced unseen. None while it follows a published environment.
   */
  draft?: string;
  /** Every file the space gave the project, by path: the sha256 of what was written. */
  files: Record<string, string>;
  /** The files fetched from the space's CDN, by path: the address each one was fetched from. */
  downloads: Record<string, string>;
  /** The packages the space's code asked for, at the ranges written into `package.json`. */
  dependencies: Record<string, string>;
  /**
   * The version of the space's data (`src/data/`) the project last had — what `plitzi push` names as its base, so data
   * pushed from another copy since is never replaced unseen. None while the project never had the space's data.
   */
  data?: string;
};

const isStrings = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every(entry => typeof entry === 'string');

export const digest = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');

/**
 * A file of the project as a pull compares it: the digest of what the project's formatter makes of it — so a file only
 * formatted since is not a file changed — and of its bytes as they are, which is what a project recorded before it had
 * a formatter. Nothing when there is no such file.
 */
export const digestsOf = async (
  root: string,
  file: string,
  format: Formatter
): Promise<{ formatted: string; raw: string } | undefined> => {
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(path.join(root, file));
  } catch {
    return undefined;
  }

  const raw = digest(bytes);

  return { formatted: isTextFile(file) ? digest(await format(file, bytes.toString('utf-8'))) : raw, raw };
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
      !isRecord(value.version) ||
      typeof value.version.environment !== 'string' ||
      (value.version.revision !== undefined && typeof value.version.revision !== 'number') ||
      (value.draft !== undefined && typeof value.draft !== 'string') ||
      !isStrings(value.files) ||
      !isStrings(value.downloads) ||
      !isStrings(value.dependencies) ||
      (value.data !== undefined && typeof value.data !== 'string')
    ) {
      return undefined;
    }

    return {
      format: 1,
      api: value.api,
      space: { id: value.space.id, name: value.space.name, permanentUrl: value.space.permanentUrl },
      source: value.source,
      version: {
        environment: value.version.environment,
        ...(typeof value.version.revision === 'number' ? { revision: value.version.revision } : {})
      },
      ...(typeof value.draft === 'string' ? { draft: value.draft } : {}),
      files: value.files,
      downloads: value.downloads,
      dependencies: value.dependencies,
      ...(typeof value.data === 'string' ? { data: value.data } : {})
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

/** What the project was given, once it is on disk: each file's digest, formatted as the project formats it. */
export const digestsOnDisk = async (
  root: string,
  files: readonly string[],
  format: Formatter
): Promise<Record<string, string>> => {
  const digests = await Promise.all(
    files.map(async file => [file, (await digestsOf(root, file, format))?.formatted] as const)
  );

  return Object.fromEntries(digests.filter((entry): entry is [string, string] => entry[1] !== undefined));
};

/**
 * The files a space gives a project — its text as the project's formatter writes it, its binaries as they are — by
 * path: what a pull compares with what is on disk, and what a push records as given once the space holds the project.
 * The files of its CDN are not among them: they are fetched, and only when the space names another address for one.
 */
export const givenFiles = async (project: ProjectFromSpace, format: Formatter): Promise<Map<string, Buffer>> => {
  const given = new Map<string, Buffer>();
  for (const [file, text] of Object.entries(project.files)) {
    given.set(file, Buffer.from(await format(file, text)));
  }

  Object.entries(project.binaries).forEach(([file, base64]) => given.set(file, Buffer.from(base64, 'base64')));

  return given;
};
