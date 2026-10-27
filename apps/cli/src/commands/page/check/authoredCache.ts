import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { buildHandles } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers';
import { CLI_DIR, PROJECT_TMP } from '@plitzi/sdk-shared/project';

import { copyOf } from '../../../runs/core/paths';
import { CLI_VERSION } from '../../../scaffold/project';

import type { Authored } from './space';
import type { LayoutHandle, PageHandle } from '@plitzi/sdk-authoring';
import type { Schema } from '@plitzi/sdk-shared';

/**
 * The project's space as `page check` authored it, kept by what it was authored from: every check loaded the project's
 * modules and authored them again — 340 ms of a run's, its source the same between one check and the next. Read
 * back, its handles are built again from the pages and layouts (`buildHandles`): what a check asks of them is theirs.
 */

/** What the space is authored from: its source, the project's own CLI files… */
const SOURCES = ['src', CLI_DIR];

/** …and its packages, as they are asked for and as they were installed: an upgrade authors it anew. */
const MANIFESTS = ['package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

/** The spaces kept at once: the one a task reads now, and the few before it a check may go back to. */
const KEEP = 4;

interface Kept {
  pages: Record<string, PageHandle>;
  layouts: Record<string, LayoutHandle>;
  schema: Schema;
  schemes: Authored['schemes'];
}

const isKept = (value: unknown): value is Kept =>
  isRecord(value) &&
  isRecord(value.pages) &&
  isRecord(value.layouts) &&
  isRecord(value.schema) &&
  Array.isArray(value.schemes);

const dirOf = (root: string): string => path.join(copyOf(root)?.root ?? root, PROJECT_TMP, 'plitzi-cache', 'authored');

/** Every file the space is authored from, by its path and its bytes, with the CLI that authors it: one digest. */
export const authoredKey = async (root: string): Promise<string> => {
  const hash = createHash('sha256').update(CLI_VERSION);
  const files = (
    await Promise.all(
      SOURCES.map(async dir =>
        (await fs.readdir(path.join(root, dir), { recursive: true, withFileTypes: true }).catch(() => []))
          .filter(entry => entry.isFile())
          .map(entry => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
      )
    )
  )
    .flat()
    .concat(MANIFESTS)
    .sort();
  for (const file of files) {
    hash.update(`\0${file}\0`);
    hash.update(await fs.readFile(path.join(root, file)).catch(() => Buffer.alloc(0)));
  }

  return hash.digest('hex').slice(0, 32);
};

/** The space authored from exactly these files, when it was kept. */
export const keptAuthored = async (root: string, key: string): Promise<Authored | undefined> => {
  const read: unknown = await fs
    .readFile(path.join(dirOf(root), `${key}.json`), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);

  return isKept(read)
    ? { handles: buildHandles(read.pages, read.layouts), schema: read.schema, schemes: read.schemes }
    : undefined;
};

/** Keeps the space authored, and lets go of the oldest past the few kept. */
export const keepAuthored = async (root: string, key: string, authored: Authored): Promise<void> => {
  const dir = dirOf(root);
  await fs.mkdir(dir, { recursive: true });
  const kept: Kept = {
    pages: authored.handles.pages,
    layouts: authored.handles.layouts,
    schema: authored.schema,
    schemes: authored.schemes
  };
  const partial = path.join(dir, `${key}.${String(process.pid)}.partial`);
  await fs.writeFile(partial, JSON.stringify(kept));
  await fs.rename(partial, path.join(dir, `${key}.json`));

  const all = await Promise.all(
    (await fs.readdir(dir))
      .filter(name => name.endsWith('.json'))
      .map(async name => ({ name, at: (await fs.stat(path.join(dir, name))).mtimeMs }))
  );
  await Promise.all(
    all
      .sort((a, b) => b.at - a.at)
      .slice(KEEP)
      .map(each => fs.rm(path.join(dir, each.name), { force: true }))
  );
};
