import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { signedIn } from './account';
import { writeFunctionsState } from './functions';
import { projectFormatter } from './projectFormatter';
import { digestsOnDisk, writeOrigin } from './spaceOrigin';
import { authorizedRequest } from '../account/session';

import type { ProjectFromSpace } from '../scaffold/fromSpace';
import type { SpaceExport } from '@plitzi/sdk-shared/source';

/**
 * `plitzi create --from <space>`: the space as Plitzi keeps it (docs/en/projects-from-spaces.md), asked for as the person — who must be able
 * to change it — and the files of it the project serves itself, fetched once.
 */

/** What the platform answered is an export: of the format this CLI writes, with every part it reads. */
const isExport = (value: unknown): value is SpaceExport =>
  isRecord(value) &&
  value.format === 1 &&
  isRecord(value.space) &&
  isRecord(value.version) &&
  isRecord(value.source) &&
  isRecord(value.builtOnly) &&
  isRecord(value.report) &&
  isRecord(value.functions) &&
  Array.isArray(value.actions) &&
  Array.isArray(value.assets) &&
  Array.isArray(value.visitorRoles);

/** Which version of a space: the draft (`main`), or a published environment's snapshot — its latest unless pinned. */
export type SpaceVersionAsked = { environment: string; revision?: number };

/** How a version is said: `the draft`, `production (latest)`, `production r3`. */
export const versionLabel = ({ environment, revision }: SpaceVersionAsked): string => {
  if (environment === 'main') {
    return 'the draft';
  }

  return revision ? `${environment} r${String(revision)}` : `${environment} (latest)`;
};

/**
 * A version of the space named — its id or its permanent URL — put together as a project, or why not, said and
 * `undefined`. `name` is what it is called in what is printed: `from`, unless a pull names it by its id.
 */
export const fetchExport = async (
  api: string,
  from: string,
  { source, version, name = from }: { source: 'local' | 'cloud'; version: SpaceVersionAsked; name?: string }
): Promise<SpaceExport | undefined> => {
  const connection = await signedIn(api, `to take ${from} out of Plitzi`);
  if (!connection) {
    return undefined;
  }

  console.log(`\nTaking ${chalk.bold(name)} (${versionLabel(version)}) out of ${api}…`);
  const query = new URLSearchParams({
    source,
    environment: version.environment,
    ...(version.revision ? { revision: String(version.revision) } : {})
  });
  const answered = await authorizedRequest<unknown>(
    connection,
    `/spaces/${encodeURIComponent(from)}/export?${query.toString()}`
  );
  if (!answered.ok) {
    console.error(chalk.red(answered.error));
    process.exitCode = 1;

    return undefined;
  }

  const { status, data } = answered.value.reply;
  if (status === 200 && isExport(data)) {
    return data;
  }

  const said = isRecord(data) && typeof data.error === 'string' ? data.error : undefined;
  const why: Partial<Record<number, string>> = {
    403: `You may not take ${from} out: it takes being able to change it — its owner, an administrator or a writer.`,
    404: said ?? `There is no space ${from} you can reach.`
  };
  console.error(chalk.red(why[status] ?? said ?? `The platform would not hand ${from} over (${String(status)}).`));
  process.exitCode = 1;

  return undefined;
};

/** A file of the space's CDN, fetched. */
export const download = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(String(response.status));
  }

  return Buffer.from(await response.arrayBuffer());
};

/** Why a file could not be fetched, as the report says it. */
export const notFetched = (to: string, url: string, error: unknown): string =>
  `${to}: could not be fetched from ${url} (${error instanceof Error ? error.message : String(error)})`;

/** The project's binary files written, and the space's files fetched from its CDN into the project to be served by it. */
export const writeFromSpace = async (target: string, project: ProjectFromSpace): Promise<string[]> => {
  for (const [file, base64] of Object.entries(project.binaries)) {
    await fs.mkdir(path.dirname(path.join(target, file)), { recursive: true });
    await fs.writeFile(path.join(target, file), Buffer.from(base64, 'base64'));
  }

  const missing: string[] = [];
  for (const { url, to } of project.downloads) {
    try {
      const bytes = await download(url);
      await fs.mkdir(path.dirname(path.join(target, to)), { recursive: true });
      await fs.writeFile(path.join(target, to), bytes);
    } catch (error) {
      missing.push(notFetched(to, url, error));
    }
  }

  return missing;
};

/** The space's functions as they are on disk: what `plitzi functions push` compares the project's with. */
export const functionsOnDisk = async (root: string, project: ProjectFromSpace): Promise<Record<string, string>> =>
  Object.fromEntries(
    await Promise.all(
      Object.keys(project.functions.files).map(
        async file => [file, await fs.readFile(path.join(root, 'functions', file), 'utf-8')] as const
      )
    )
  );

/**
 * What the project was given, recorded once it is on disk as it will stay — installed and formatted — so `plitzi pull`
 * tells what changed here from what changed on the space; and its functions as a pulled working copy, so `plitzi
 * functions push` sends them back to the space they came from.
 */
export const recordOrigin = async (
  root: string,
  {
    api,
    exported,
    source,
    pinned,
    project
  }: {
    api: string;
    exported: SpaceExport;
    source: 'local' | 'cloud';
    /** Whether the revision was asked for: pinned, a pull keeps to it; not, it follows the environment's latest. */
    pinned: boolean;
    project: ProjectFromSpace;
  }
): Promise<void> => {
  const files = await digestsOnDisk(
    root,
    [...Object.keys(project.files), ...Object.keys(project.binaries), ...project.downloads.map(({ to }) => to)],
    await projectFormatter(root)
  );
  await writeOrigin(root, {
    format: 1,
    api,
    space: exported.space,
    source,
    version: {
      environment: exported.version.environment,
      ...(pinned ? { revision: exported.version.revision } : {})
    },
    files,
    downloads: Object.fromEntries(
      project.downloads.filter(({ to }) => Object.hasOwn(files, to)).map(({ url, to }) => [to, url])
    ),
    dependencies: project.dependencies
  });
  await writeFunctionsState(root, {
    space: exported.space.id,
    version: project.functions.version,
    files: await functionsOnDisk(root, project)
  });
};
