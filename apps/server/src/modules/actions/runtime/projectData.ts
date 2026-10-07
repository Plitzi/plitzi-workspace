import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import type { ActionLookups, SpaceRevision } from '../types';

/** How a server reaches a space's data: its files' text by path (`products.json`), as of a revision. */
export type ProjectDataLookup = NonNullable<ActionLookups['getData']>;

/** What a project keeps in its data folder: JSON, the only files `plitzi space push` sends as the space's data. */
const DATA_EXTENSION = '.json';

/**
 * A data folder as the lookup a deployment would otherwise write — what a self-hosted server derives from `dataDir`, so
 * a `/data/<file>` provider and a function's `ctx.data` read the folder one way. A folder has no revisions: every
 * revision is what is on disk now. A file is read again only once it changed, so a page asking per render costs the
 * folder's listing and nothing more.
 */
export const dataDirLookup = (dataDir: string): ProjectDataLookup => {
  const root = path.resolve(dataDir);
  const kept = new Map<string, { mtimeMs: number; size: number; text: string }>();

  return async () => {
    let names: string[];
    try {
      names = await readdir(root, { recursive: true });
    } catch {
      return undefined;
    }

    const read = await Promise.all(
      names
        .filter(name => name.endsWith(DATA_EXTENSION))
        .map(async (name): Promise<[string, string] | undefined> => {
          const file = path.join(root, name);
          const key = name.split(path.sep).join('/');
          try {
            const { mtimeMs, size } = await stat(file);
            const known = kept.get(key);
            const text =
              known && known.mtimeMs === mtimeMs && known.size === size ? known.text : await readFile(file, 'utf8');
            kept.set(key, { mtimeMs, size, text });

            return [key, text];
          } catch {
            // Gone between the listing and the read: a file being saved, which the next read finds.
            kept.delete(key);

            return undefined;
          }
        })
    );
    const files = Object.fromEntries(read.filter(entry => entry !== undefined));
    kept.forEach((_entry, key) => {
      if (!(key in files)) {
        kept.delete(key);
      }
    });

    return files;
  };
};

/**
 * `ctx.data` for one run: one file of the space's data, as of the run's revision, parsed.
 *
 * The lookup is asked once per run, whatever the code reads and however often — every read of one run sees the same
 * version of the data — and each read is parsed afresh, so code that changes what it was handed changes nothing the
 * next read gets.
 */
export const projectDataReader = (
  getData: ProjectDataLookup | undefined,
  spaceId: number,
  at: SpaceRevision | undefined
): ((file: string) => Promise<unknown>) => {
  let files: Promise<Record<string, string> | undefined> | undefined;

  return async file => {
    if (!getData) {
      throw new Error(
        'This server keeps no data for its spaces: ctx.data reads what a deployment answers with action.lookups.getData, or the files of dataDir'
      );
    }

    files ??= getData(spaceId, at);
    const text = (await files)?.[file];
    if (text === undefined) {
      throw new Error(`"${file}" is not a file of this space's data — ctx.data takes its path under src/data/`);
    }

    try {
      const data: unknown = JSON.parse(text);

      return data;
    } catch {
      throw new Error(`"${file}" of this space's data is not JSON`);
    }
  };
};
