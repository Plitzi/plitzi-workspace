import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { apiFor } from './account';
import { download, fetchExport, functionsOnDisk, notFetched, versionLabel } from './createFrom';
import { findProject } from './existingProject';
import { writeFunctionsState } from './functions';
import { projectFormatter } from './projectFormatter';
import { digest, digestsOf, givenFiles, readOrigin, writeOrigin } from './spaceOrigin';
import { fail } from './terminal';
import { installCommand } from '../scaffold';
import { projectFromSpace } from '../scaffold/fromSpace';

import type { AccountOptions } from './account';
import type { SpaceOrigin } from './spaceOrigin';
import type { PackageManager } from '../scaffold';

/**
 * `plitzi pull`: a project `plitzi create --from` made, brought up to date with the space it came from (docs/en/projects-from-spaces.md).
 *
 * The project is the developer's — they edit it — and the space goes on being edited in the builder. So a pull asks
 * two questions of every file the space gives: did it change here, and did it change on the space. Changed on the space
 * alone, it is written; changed here alone, it is kept; changed on both, nothing is written at all and the files are
 * named, unless `--force` says the space's copy wins. `.env` and `package.json` are the project's: a pull never writes
 * the first, and only adds to the second the packages the space's code now asks for.
 */

export interface PullOptions extends AccountOptions {
  force?: boolean;
  /** Follow another version from now on: the draft (`main`) or a published environment. */
  environment?: string;
  /** Pin a published revision; `latest` follows the environment's newest again. */
  revision?: string;
}

/** The version a pull asks for: the one the project follows, or the one it is told to follow from now on. */
const versionToPull = (
  options: PullOptions,
  followed: SpaceOrigin['version']
): { ok: true; version: SpaceOrigin['version'] } | { ok: false; error: string } => {
  const environment = options.environment ?? followed.environment;
  // A pin holds while the environment does: a different one starts from its latest unless a revision comes with it.
  const kept = environment === followed.environment ? followed.revision : undefined;
  if (options.revision === undefined || options.revision === 'latest') {
    const revision = options.revision === 'latest' ? undefined : kept;

    return { ok: true, version: { environment, ...(revision ? { revision } : {}) } };
  }

  const revision = Number(options.revision);
  if (environment === 'main') {
    return { ok: false, error: 'The draft (main) has no revisions: name a published environment with --environment.' };
  }

  if (!Number.isInteger(revision) || revision < 1) {
    return { ok: false, error: `--revision takes a revision number from 1, or latest — not "${options.revision}".` };
  }

  return { ok: true, version: { environment, revision } };
};

/** A file's digest as the space gives it now (`given`), as it was last given (`was`), and as it is here (`here`). */
export type FileState = { given?: string; was?: string; here?: string };

/**
 * What a pull does to one file.
 *
 * - `same` — nothing: it is already what the space gives, or it was never the space's.
 * - `write` — the space changed it, or gives it for the first time, and it was not changed here.
 * - `remove` — the space no longer gives it, and it was not changed here.
 * - `keep` — changed here, and the space did not change it (or no longer gives it): the change here stands.
 * - `conflict` — changed here AND on the space, differently.
 */
export type Verdict = 'same' | 'write' | 'remove' | 'keep' | 'conflict';

export const verdictOf = ({ given, was, here }: FileState): Verdict => {
  if (given === undefined) {
    if (here === undefined || was === undefined) {
      return 'same';
    }

    return here === was ? 'remove' : 'keep';
  }

  if (here === given) {
    return 'same';
  }

  if (here === undefined) {
    if (was === undefined) {
      return 'write';
    }

    // Deleted here: kept deleted while the space leaves it be.
    return given === was ? 'keep' : 'conflict';
  }

  if (here === was) {
    return 'write';
  }

  return given === was ? 'keep' : 'conflict';
};

/**
 * The packages the space's code asks for, added to the project's `package.json`: a package it does not list is added,
 * one still at the range the space last asked for follows the space, and one the project changed stays as it is.
 */
const mergeDependencies = (
  manifest: Record<string, unknown>,
  asked: Record<string, string>,
  before: Record<string, string>
): { manifest: Record<string, unknown>; changed: string[]; kept: string[] } => {
  const current = isRecord(manifest.dependencies) ? manifest.dependencies : {};
  const dependencies: Record<string, unknown> = { ...current };
  const changed: string[] = [];
  const kept: string[] = [];
  Object.entries(asked).forEach(([name, range]) => {
    const listed = current[name];
    if (listed === range) {
      return;
    }

    if (listed === undefined || listed === before[name]) {
      dependencies[name] = range;
      changed.push(`${name}@${range}`);

      return;
    }

    kept.push(`${name}: the space's code now asks for ${range}, and package.json keeps ${JSON.stringify(listed)}`);
  });

  return {
    manifest: {
      ...manifest,
      dependencies: Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)))
    },
    changed,
    kept
  };
};

const writeBytes = async (root: string, file: string, bytes: Buffer): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), bytes);
};

const list = (files: readonly string[]): string => files.map(file => `\n  ${file}`).join('');

const plural = (count: number, noun: string): string => `${String(count)} ${noun}${count === 1 ? '' : 's'}`;

export const pull = async (options: PullOptions): Promise<void> => {
  const project = await findProject(process.cwd());
  const root = project?.root ?? process.cwd();
  const origin = await readOrigin(root);
  if (!origin) {
    fail(
      'This project was not made from a space: there is no .plitzi/space.json here. plitzi create --from <space> makes one.'
    );

    return;
  }

  const api = options.api ? await apiFor(options) : origin.api;
  if (!api) {
    return;
  }

  const asked = versionToPull(options, origin.version);
  if (!asked.ok) {
    fail(asked.error);

    return;
  }

  const exported = await fetchExport(api, String(origin.space.id), {
    source: origin.source,
    version: asked.version,
    name: origin.space.name
  });
  if (!exported) {
    return;
  }

  const next = projectFromSpace(exported, origin.source);
  const format = await projectFormatter(root);
  const given = await givenFiles(next, format);

  // A file of the CDN is fetched again only when the space names another address for it, or it is not here. One that
  // is the same, or could not be fetched, is left as it is — never taken for a file the space no longer gives.
  const missing: string[] = [];
  const untouched = new Set<string>();
  for (const { url, to } of next.downloads) {
    if (origin.downloads[to] === url && (await digestsOf(root, to, format)) !== undefined) {
      untouched.add(to);
      continue;
    }

    try {
      given.set(to, await download(url));
    } catch (error) {
      missing.push(notFetched(to, url, error));
      untouched.add(to);
    }
  }

  const paths = [...new Set([...given.keys(), ...Object.keys(origin.files)])].filter(file => !untouched.has(file));
  const verdicts = new Map<string, Verdict>();
  for (const file of paths) {
    const bytes = given.get(file);
    const here = await digestsOf(root, file, format);
    const was = origin.files[file];
    // Unchanged since it was given — as it was recorded, or only formatted since: recorded before the project had a
    // formatter, a file was recorded as its bytes were.
    const unchanged = here !== undefined && (here.raw === was || here.formatted === was);
    verdicts.set(
      file,
      verdictOf({
        given: bytes ? digest(bytes) : undefined,
        was: unchanged ? here.formatted : was,
        here: here?.formatted
      })
    );
  }

  const of = (verdict: Verdict): string[] =>
    [...verdicts].filter(([, value]) => value === verdict).map(([file]) => file);
  const conflicts = of('conflict');
  if (conflicts.length > 0 && !options.force) {
    fail(
      `Nothing was pulled: these changed here and on ${origin.space.name} too:${list(conflicts)}\n` +
        'Commit or set aside the changes here and pull again, or pass --force to take the space’s copy of them.'
    );

    return;
  }

  const written = [...of('write'), ...conflicts];
  for (const file of written) {
    const bytes = given.get(file);
    if (bytes) {
      await writeBytes(root, file, bytes);
    }
  }

  const removed = of('remove');
  await Promise.all(removed.map(file => fs.rm(path.join(root, file), { force: true })));

  const packageFile = path.join(root, 'package.json');
  const manifest: unknown = JSON.parse(await fs.readFile(packageFile, 'utf-8'));
  const dependencies = mergeDependencies(isRecord(manifest) ? manifest : {}, next.dependencies, origin.dependencies);
  if (dependencies.changed.length > 0) {
    await fs.writeFile(packageFile, `${JSON.stringify(dependencies.manifest, null, 2)}\n`);
  }

  const files = Object.fromEntries([
    ...[...given].map(([file, bytes]) => [file, digest(bytes)] as const),
    ...[...untouched].flatMap(file => (origin.files[file] ? [[file, origin.files[file]] as const] : []))
  ]);
  const updated: SpaceOrigin = {
    format: origin.format,
    api,
    source: origin.source,
    space: exported.space,
    version: asked.version,
    ...(exported.draft ? { draft: exported.draft } : {}),
    files,
    downloads: Object.fromEntries(
      next.downloads.flatMap(({ url, to }) => {
        if (given.has(to)) {
          return [[to, url]];
        }

        const before = origin.downloads[to];

        return before && Object.hasOwn(files, to) ? [[to, before]] : [];
      })
    ),
    dependencies: next.dependencies
  };
  await writeOrigin(root, updated);

  // The functions as a working copy of the space's again — unless a change here to one of them still stands.
  const functionsKept = of('keep').some(file => file.startsWith('functions/'));
  if (!functionsKept) {
    await writeFunctionsState(root, {
      space: exported.space.id,
      version: next.functions.version,
      files: await functionsOnDisk(root, next)
    });
  }

  const kept = of('keep');
  console.log(
    chalk.green(
      `\nPulled ${exported.space.name} (${versionLabel(exported.version)}): ${plural(written.length, 'file')} written, ${plural(removed.length, 'file')} removed.`
    )
  );
  if (written.length > 0) {
    console.log(chalk.dim(list(written)));
  }

  if (kept.length > 0) {
    console.log(`Changed here, and kept:${list(kept)}`);
  }

  if (dependencies.changed.length > 0) {
    const manager: PackageManager = project?.packageManager ?? 'npm';
    console.log(`package.json now asks for ${dependencies.changed.join(', ')}: run ${installCommand(manager)}.`);
  }

  const notes = [...dependencies.kept, ...missing, ...next.report];
  if (notes.length > 0) {
    console.log(chalk.yellow(`\nWhat to know about ${exported.space.name} here:`));
    notes.forEach(note => console.log(chalk.yellow(`  - ${note}`)));
  }

  console.log('');
};
