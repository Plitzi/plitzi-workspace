import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { PUBLIC_ASSETS_DIR, onItsCdn, projectDataFiles } from './projectFiles';
import { fail } from './terminal';
import { authorizedRequest } from '../account/session';
import { DATA_DIR } from '../scaffold/paths';

import type { PushOutcome } from './pushOutcome';
import type { Target } from './uploadPlugin';
import type { ConnectedSpace, Connection } from '../account/connection';

/**
 * The two parts of a project `plitzi push` sends besides its code and its space: its data (`src/data/`, read by its
 * providers on the server, never served) and its files (`public/assets/`, served to anyone from the space's CDN). Each
 * lands where Plitzi keeps it, and comes back to the same path with `plitzi pull`.
 */

/** The types the space's CDN takes, by extension: what an image, a sound, a video or a JSON file is sent as. */
const ASSET_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  webm: 'video/webm',
  json: 'application/json',
  mjs: 'text/javascript'
};

/** What a file of `public/assets/` is sent as — or nothing, for one the space's CDN does not take. */
export const assetTypeOf = (file: string): string | undefined => ASSET_TYPES[path.extname(file).slice(1).toLowerCase()];

/**
 * `src/data/` saved as the space's draft data, whole: refused when the space's copy moved on since the project last had
 * it (`base`) — another copy pushed it — unless `force`. CDN addresses the project wrote as its paths go back as they
 * were. Answers the new version, which the project records as its base.
 */
export const pushDataOf = async (
  root: string,
  connection: Connection,
  space: ConnectedSpace,
  { base, force, downloads }: { base: string | undefined; force: boolean; downloads: Readonly<Record<string, string>> }
): Promise<{ outcome: PushOutcome; version?: string }> => {
  const files = Object.fromEntries(
    await Promise.all(
      (await projectDataFiles(root)).map(
        async file =>
          [
            path.relative(DATA_DIR, file).split(path.sep).join('/'),
            onItsCdn(await fs.readFile(path.join(root, file), 'utf-8'), downloads)
          ] as const
      )
    )
  );
  const answered = await authorizedRequest<{
    ok?: boolean;
    version?: string;
    problems?: { file: string; message: string }[];
    refusal?: { error?: string };
    error?: string;
  }>(connection, `/spaces/${String(space.id)}/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, ...(base && !force ? { base } : {}) })
  });
  if (!answered.ok) {
    fail(answered.error);

    return { outcome: 'failed' };
  }

  const { status, data } = answered.value.reply;
  if (status === 422 && data.problems) {
    fail(
      `${space.name} would not take the data:${data.problems.map(problem => `\n  ${DATA_DIR}/${problem.file} ${problem.message}`).join('')}`
    );

    return { outcome: 'failed' };
  }

  if (status === 409 && base) {
    fail(
      `${space.name}’s data changed since this project last had it — pushed from another copy.\n` +
        'Pull first (plitzi pull) and push again, or pass --force to replace it with this project’s.'
    );

    return { outcome: 'failed' };
  }

  if (status !== 200 || !data.version) {
    fail(data.refusal?.error ?? data.error ?? `The data was not pushed (${String(status)}).`);

    return { outcome: 'failed' };
  }

  console.log(
    chalk.green(`${space.name}’s data is the project’s now — ${String(Object.keys(files).length)} files.`) +
      chalk.dim(' The live site reads it once the space is published.')
  );

  return { outcome: 'pushed', version: data.version };
};

/**
 * The files of `public/assets/` that changed, each put at the same path under the space's `assets/` on its CDN — so the
 * space can name it there, and a pull brings it back where it was. Answers each one's address, by its path in the
 * project; a type the CDN does not take is said, and sent nowhere.
 */
export const pushFilesOf = async (
  root: string,
  connection: Connection,
  space: ConnectedSpace,
  { files, target }: { files: readonly string[]; target: Target }
): Promise<{ outcome: PushOutcome; uploaded: Record<string, string> }> => {
  const uploaded: Record<string, string> = {};
  const refused = files.filter(file => assetTypeOf(file) === undefined);
  if (refused.length > 0) {
    console.log(
      chalk.yellow(
        `Not sent — the space's CDN takes images, sounds, videos and JSON: ${refused.join(', ')}. Serve them from this project, or convert them.`
      )
    );
  }

  for (const file of files.filter(each => assetTypeOf(each) !== undefined)) {
    const assetPath = path.relative(PUBLIC_ASSETS_DIR, file).split(path.sep).join('/');
    const query = new URLSearchParams({ path: assetPath, bucket: target.bucket.identifier });
    const answered = await authorizedRequest<{ url?: string; error?: string }>(
      connection,
      `/spaces/${String(space.id)}/cdns/${encodeURIComponent(target.cdn.identifier)}/assets?${query}`,
      {
        method: 'POST',
        headers: { 'Content-Type': assetTypeOf(file) ?? 'application/octet-stream' },
        // A copy on an ArrayBuffer of its own: a Buffer may sit on a shared pool, which a request body cannot be.
        body: new Uint8Array(await fs.readFile(path.join(root, file)))
      }
    );
    if (!answered.ok) {
      fail(answered.error);

      return { outcome: 'failed', uploaded };
    }

    const { status, data } = answered.value.reply;
    if (status !== 201 || !data.url) {
      fail(`${file} was not put on the CDN: ${data.error ?? String(status)}`);

      return { outcome: 'failed', uploaded };
    }

    uploaded[file] = data.url;
  }

  const count = Object.keys(uploaded).length;
  if (count > 0) {
    console.log(
      chalk.green(`${String(count)} file${count === 1 ? '' : 's'} of ${PUBLIC_ASSETS_DIR}/ on ${space.name}’s CDN.`)
    );
  }

  return { outcome: count > 0 ? 'pushed' : 'unchanged', uploaded };
};
