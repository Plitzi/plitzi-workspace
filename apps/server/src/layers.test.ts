import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = path.dirname(fileURLToPath(import.meta.url));

const sourcesUnder = (folder: string): string[] =>
  readdirSync(path.join(SRC, folder), { recursive: true, encoding: 'utf-8' })
    .filter(entry => /\.tsx?$/u.test(entry) && !/\.test\.tsx?$/u.test(entry) && !entry.includes('fixtures'))
    .map(entry => path.join(SRC, folder, entry));

/** Every relative module a file imports, resolved to a path under `src` (without its extension). */
const importsOf = (file: string): string[] =>
  [...readFileSync(file, 'utf-8').matchAll(/(?:from|import)\s+'(\.[^']+)'/gu)].map(([, specifier]) =>
    path.relative(SRC, path.resolve(path.dirname(file), specifier))
  );

/**
 * The server's layers, in the direction they may lean: `hosts` (a whole server put together for one use — a project's
 * page server, the authoring host) build on `core`'s composition root, which assembles `modules`, which use `core`'s
 * primitives. A module that reached up to the root — or anything that reached into a host — would close a loop the
 * folders exist to keep open.
 */
describe('the server’s layers', () => {
  it('keeps a module from importing the composition root that assembles it', () => {
    const offenders = sourcesUnder('modules').flatMap(file =>
      importsOf(file)
        .filter(target => target === 'core/createServer' || target === 'core/server/pageServer')
        .map(target => `${path.relative(SRC, file)} → ${target}`)
    );

    expect(offenders).toEqual([]);
  });

  it('keeps core and the modules from importing a host', () => {
    const offenders = [...sourcesUnder('core'), ...sourcesUnder('modules')].flatMap(file =>
      importsOf(file)
        .filter(target => target.startsWith('hosts/'))
        .map(target => `${path.relative(SRC, file)} → ${target}`)
    );

    expect(offenders).toEqual([]);
  });
});
