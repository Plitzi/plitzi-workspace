import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { PluginManager } from './manager';

/**
 * What a dev server does when the component behind a plugin is edited.
 *
 * The failure this guards against is silent and expensive: the page renders, the plugin works, and it is the version
 * from whenever the server started. Every mechanism that would normally catch a change misses this one — the entry
 * file's timestamp does not move when the component beside it is edited, a versioned plugin never expires, and the
 * components are named by PATH rather than imported, so the file watcher does not even restart the process.
 */

const dirs: string[] = [];

const workspace = async (): Promise<{ dir: string; entry: string; component: string; cache: string }> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-plugins-'));
  dirs.push(dir);
  const source = path.join(dir, 'src');
  await fs.mkdir(source, { recursive: true });

  const entry = path.join(source, 'index.ts');
  const component = path.join(source, 'Widget.ts');
  // A barrel over a component, which is how every plugin in this product is laid out.
  await fs.writeFile(entry, 'export { widget } from "./Widget";\n');
  await fs.writeFile(component, 'export const widget = "first";\n');

  return { dir, entry, component, cache: path.join(dir, 'cache') };
};

const bundle = async (cache: string, key: string): Promise<string> =>
  fs.readFile(path.join(cache, key, 'index.js'), 'utf-8');

afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
});

describe('PluginManager staleness', () => {
  it('rebuilds when a file the bundle was built from changes, not only the entry', async () => {
    const { entry, component, cache } = await workspace();
    const manager = new PluginManager(
      { widget: { js: entry, action: 'compile', version: '1.0.0' } },
      cache,
      60_000,
      true
    );

    await manager.prepare('widget');
    expect(await bundle(cache, 'widget')).toContain('first');

    // Edited in the past-proof direction: the check compares against when the bundle was built, and a build that
    // finished in the same millisecond as the write would otherwise decide nothing had happened.
    await fs.writeFile(component, 'export const widget = "second";\n');
    const future = new Date(Date.now() + 5_000);
    await fs.utimes(component, future, future);

    await manager.prepare('widget');

    expect(await bundle(cache, 'widget')).toContain('second');
  });

  /** A deployment's plugins do not change under it, and stat'ing them on every render would be a cost for no answer. */
  it('never re-checks outside dev mode', async () => {
    const { entry, component, cache } = await workspace();
    const manager = new PluginManager(
      { widget: { js: entry, action: 'compile', version: '1.0.0' } },
      cache,
      60_000,
      false
    );

    await manager.prepare('widget');
    await fs.writeFile(component, 'export const widget = "second";\n');
    const future = new Date(Date.now() + 5_000);
    await fs.utimes(component, future, future);

    await manager.prepare('widget');

    expect(await bundle(cache, 'widget')).toContain('first');
  });

  /** An untouched plugin is served from memory: the check is throttled, and it has nothing to report anyway. */
  it('keeps serving the bundle while nothing has changed', async () => {
    const { entry, cache } = await workspace();
    const manager = new PluginManager(
      { widget: { js: entry, action: 'compile', version: '1.0.0' } },
      cache,
      60_000,
      true
    );

    const first = await manager.prepare('widget');
    const second = await manager.prepare('widget');

    expect(second).toBe(first);
  });
});
