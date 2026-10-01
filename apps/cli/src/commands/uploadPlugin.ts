import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';
import { unzipSync } from 'fflate';

import { apiFor, connectionWithSpace, fail } from './account';
import { findProject } from './existingProject';
import { keepSource } from './keepSource';
import { askPick, atTerminal, refuseWithoutTerminal } from './terminal';
import { authorizedRequest } from '../account/session';
import { sourceFileOf } from '../pack/pack';

import type { AccountOptions } from './account';

/**
 * `plitzi upload plugin`: a packed plugin put on one of the connected space's CDNs, and installed there — what the
 * builder does when its zip is dropped under Resources, without the builder.
 *
 * Always to the space the CLI is connected to, and to no other: which one that is, `plitzi whoami` says and
 * `plitzi space` changes. Signing in and choosing a space happen in the browser when there is no connection yet, so the
 * first upload is one command too.
 */

export interface UploadPluginOptions extends AccountOptions {
  cdn?: string;
  bucket?: string;
}

interface Bucket {
  identifier: string;
  name: string;
  /** A private bucket has no public address: it keeps the space's server code, and no page could load a plugin from it. */
  visibility: 'public' | 'private';
  domain: string;
}

interface Cdn {
  identifier: string;
  name: string;
  provider: string;
  buckets: Bucket[];
}

/** Where a plugin can go: a public bucket of one of the space's CDNs. */
interface Target {
  cdn: Cdn;
  bucket: Bucket;
}

interface Manifest {
  root: string;
  version: string;
}

/** The zips `plitzi pack plugin` leaves: at a plugin package's root, or under `dist/plugins` of any other project. */
const packedZips = async (root: string): Promise<string[]> => {
  const inFolder = async (dir: string): Promise<string[]> => {
    try {
      return (await fs.readdir(dir)).filter(file => file.endsWith('.zip')).map(file => path.join(dir, file));
    } catch {
      return [];
    }
  };

  const zips = [...(await inFolder(root)), ...(await inFolder(path.join(root, 'dist/plugins')))];
  const modified = await Promise.all(zips.map(async zip => (await fs.stat(zip)).mtimeMs));

  // Newest first: the one just packed is the likeliest to be the one meant.
  return zips
    .map((zip, index) => ({ zip, at: modified[index] }))
    .sort((a, b) => b.at - a.at)
    .map(({ zip }) => zip);
};

/** The zip named, or the one packed here — asked for at a terminal when there are several. */
const chooseZip = async (given: string | undefined): Promise<string | undefined> => {
  if (given) {
    return path.resolve(given);
  }

  const project = await findProject(process.cwd());
  const zips = project ? await packedZips(project.root) : [];
  if (zips.length === 0) {
    fail('No packed plugin here. Build one with plitzi pack plugin, or name it: plitzi upload plugin <file.zip>.');

    return undefined;
  }

  if (zips.length === 1) {
    return zips[0];
  }

  const choices = zips.map(zip => path.relative(process.cwd(), zip));
  if (!atTerminal()) {
    refuseWithoutTerminal(
      'upload',
      [{ flag: '<zip> (the argument)', choices, question: 'Which packed plugin is to be uploaded?' }],
      'plitzi upload plugin stopped before uploading anything: which plugin goes to the space is a choice'
    );

    return undefined;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await askPick(
      rl,
      'Which packed plugin? The newest is first.',
      zips.map((zip, index) => ({ label: choices[index], value: zip }))
    );
  } finally {
    rl.close();
  }
};

/**
 * The manifest a zip carries at its root, read here before anything is sent: a zip that is not a plugin is refused by
 * the platform too, but only after it has travelled.
 */
const manifestOf = (zip: Uint8Array): Manifest | undefined => {
  try {
    // Unpacked with only that one file let through, so it is the first entry or there is none.
    const entry = Object.values(unzipSync(zip, { filter: file => file.name === 'plugin-manifest.json' })).at(0);
    // Somebody's JSON: both fields read are checked below.
    const parsed = entry ? (JSON.parse(new TextDecoder().decode(entry)) as { root?: unknown; version?: unknown }) : {};

    return typeof parsed.root === 'string' && parsed.root
      ? { root: parsed.root, version: typeof parsed.version === 'string' ? parsed.version : '' }
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The public bucket a plugin goes in — the one `--cdn` and `--bucket` name, the only one there is, or the one picked.
 * A private bucket keeps server code and has no public address, so it is never one.
 */
const chooseTarget = async (
  cdns: Cdn[],
  { cdn: givenCdn, bucket: givenBucket }: { cdn?: string; bucket?: string },
  spaceName: string
): Promise<Target | undefined> => {
  if (givenCdn && !cdns.some(cdn => cdn.identifier === givenCdn)) {
    fail(`${spaceName} has no CDN "${givenCdn}". Its CDNs: ${cdns.map(cdn => cdn.identifier).join(', ')}.`);

    return undefined;
  }

  const candidates = cdns
    .filter(cdn => !givenCdn || cdn.identifier === givenCdn)
    .flatMap(cdn => cdn.buckets.map(bucket => ({ cdn, bucket })));
  if (givenBucket) {
    const named = candidates.find(({ bucket }) => bucket.identifier === givenBucket);
    if (!named) {
      fail(`${spaceName} has no bucket "${givenBucket}"${givenCdn ? ` in the CDN "${givenCdn}"` : ''}.`);

      return undefined;
    }

    if (named.bucket.visibility === 'private') {
      fail(`"${givenBucket}" is a private bucket: it has no public address, so no page could load a plugin from it.`);

      return undefined;
    }

    return named;
  }

  const targets = candidates.filter(({ bucket }) => bucket.visibility === 'public');
  if (targets.length === 0) {
    fail(`${spaceName} has no public bucket to put a plugin in. Add one to a CDN in the builder, under Resources.`);

    return undefined;
  }

  if (targets.length === 1) {
    return targets[0];
  }

  if (!atTerminal()) {
    refuseWithoutTerminal(
      'upload',
      [
        {
          flag: '--bucket',
          choices: targets.map(({ bucket }) => bucket.identifier),
          question: `Which of ${spaceName}'s public buckets does the plugin go in? (narrow with --cdn)`
        }
      ],
      'plitzi upload plugin stopped before uploading anything: which bucket serves the plugin is a choice'
    );

    return undefined;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await askPick(
      rl,
      `Which of ${spaceName}'s public buckets does the plugin go in?`,
      targets.map(target => ({
        label: `${target.cdn.name} — ${target.bucket.name} ${chalk.dim(`${target.bucket.identifier} · ${target.bucket.domain}`)}`,
        value: target
      }))
    );
  } finally {
    rl.close();
  }
};

const uploadPluginCommand = async (zipGiven: string | undefined, options: UploadPluginOptions): Promise<void> => {
  const api = await apiFor(options);
  const zipPath = api ? await chooseZip(zipGiven) : undefined;
  if (!api || !zipPath) {
    return;
  }

  let zip: Buffer;
  try {
    zip = await fs.readFile(zipPath);
  } catch {
    fail(`Could not read ${zipPath}.`);

    return;
  }

  const manifest = manifestOf(zip);
  if (!manifest) {
    fail(
      `${path.basename(zipPath)} is not a plugin: it has no plugin-manifest.json at its root. Build it with plitzi pack plugin.`
    );

    return;
  }

  const connection = await connectionWithSpace(api, 'to upload to');
  if (!connection?.space) {
    return;
  }

  const { space } = connection;
  const listed = await authorizedRequest<{ cdns?: Cdn[]; error?: string }>(connection, `/spaces/${space.id}/cdns`);
  if (!listed.ok) {
    fail(listed.error);

    return;
  }

  if (listed.value.reply.status !== 200) {
    fail(listed.value.reply.data.error ?? `Could not list ${space.name}'s CDNs (${listed.value.reply.status}).`);

    return;
  }

  const target = await chooseTarget(listed.value.reply.data.cdns ?? [], options, space.name);
  if (!target) {
    return;
  }

  const { cdn, bucket } = target;

  const label = `${manifest.root}${manifest.version ? ` ${manifest.version}` : ''}`;
  console.log(`\nUploading ${chalk.bold(label)} to ${chalk.bold(space.name)}, in ${cdn.name} — ${bucket.name}…`);
  const query = new URLSearchParams({ filename: path.basename(zipPath), bucket: bucket.identifier });
  const uploaded = await authorizedRequest<{
    resource?: { path?: string };
    installed?: 'added' | 'updated';
    error?: string;
  }>(listed.value.connection, `/spaces/${space.id}/cdns/${encodeURIComponent(cdn.identifier)}/plugins?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    // A copy on an ArrayBuffer of its own: a Buffer may sit on a shared pool, which a request body cannot be.
    body: new Uint8Array(zip)
  });
  if (!uploaded.ok) {
    fail(uploaded.error);

    return;
  }

  const { status, data } = uploaded.value.reply;
  if (status === 413) {
    fail(`${path.basename(zipPath)} is larger than ${api} accepts.`);

    return;
  }

  if (status !== 201) {
    fail(data.error ?? `The upload was refused (${status}).`);

    return;
  }

  const installed = data.installed === 'updated' ? `now loads ${label}` : `loads ${label} from now on`;
  console.log(chalk.green(`\n${space.name} ${installed}.`));
  if (data.resource?.path) {
    console.log(chalk.dim(`  ${data.resource.path}`));
  }

  console.log(chalk.dim('  Any builder open on the space loads it now.'));

  // Packed beside the zip by `plitzi pack plugin`, when its source could be: a zip from elsewhere goes up built only.
  const source = await fs.readFile(sourceFileOf(zipPath)).catch(() => undefined);
  if (source) {
    await keepSource(uploaded.value.connection, space.id, source);
  }

  console.log('');
};

export default uploadPluginCommand;
