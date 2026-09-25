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

  /**
   * A plugin moved into a folder of its own — `Widget.ts` becoming `Widget/index.ts` — is registered under a new entry,
   * and every file the old bundle was built from is gone. Stat'ing a missing file used to count as "not changed", so a
   * versioned plugin kept serving the bundle of a component that no longer existed, for as long as the cache lived.
   */
  it('rebuilds when the registered entry is not a file the bundle was built from', async () => {
    const { dir, entry, cache } = await workspace();
    await new PluginManager(
      { widget: { js: entry, action: 'compile', version: '1.0.0' } },
      cache,
      60_000,
      true
    ).prepare('widget');

    const moved = path.join(dir, 'src', 'Widget', 'index.ts');
    await fs.mkdir(path.dirname(moved), { recursive: true });
    await fs.writeFile(moved, 'export const widget = "moved";\n');
    await fs.rm(entry);
    await new PluginManager(
      { widget: { js: moved, action: 'compile', version: '1.0.0' } },
      cache,
      60_000,
      true
    ).prepare('widget');

    expect(await bundle(cache, 'widget')).toContain('moved');
  });

  it('rebuilds when a file the bundle was built from has been deleted', async () => {
    const { entry, component, cache } = await workspace();
    const manager = new PluginManager(
      { widget: { js: entry, action: 'compile', version: '1.0.0' } },
      cache,
      60_000,
      true
    );
    await manager.prepare('widget');

    // The barrel stops importing the component and the component is deleted: the entry's own edit is in the past of
    // the build, so only the missing file can say anything changed.
    await fs.writeFile(entry, 'export const widget = "inline";\n');
    const past = new Date(Date.now() - 60_000);
    await fs.utimes(entry, past, past);
    await fs.rm(component);
    await new PluginManager(
      { widget: { js: entry, action: 'compile', version: '1.0.0' } },
      cache,
      60_000,
      true
    ).prepare('widget');

    expect(await bundle(cache, 'widget')).toContain('inline');
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

/**
 * With workers, one process invalidates a plugin — the files go — and the others are told to forget it. Forgetting
 * must leave the disk alone: the others share it, and the files may already be the rebuild.
 */
describe('PluginManager forget and invalidate', () => {
  const exists = (file: string) =>
    fs.access(file).then(
      () => true,
      () => false
    );

  it('forgets a plugin without touching its files, and prepares it afresh next time', async () => {
    const { entry, cache } = await workspace();
    const manager = new PluginManager({ widget: { js: entry, action: 'compile' } }, cache, 60_000, false);
    const first = await manager.prepare('widget');

    manager.forget('widget');

    expect(await exists(path.join(cache, 'widget', 'index.js'))).toBe(true);
    const again = await manager.prepare('widget');
    expect(again).not.toBe(first);
    expect(again).toEqual(first);
  });

  it('forgets every plugin, and still leaves the disk alone', async () => {
    const { entry, cache } = await workspace();
    const manager = new PluginManager({ widget: { js: entry, action: 'compile' } }, cache, 60_000, false);
    await manager.prepare('widget');

    manager.forget();

    expect(await exists(path.join(cache, 'widget', 'index.js'))).toBe(true);
  });

  it('removes the files when it invalidates', async () => {
    const { entry, cache } = await workspace();
    const manager = new PluginManager({ widget: { js: entry, action: 'compile' } }, cache, 60_000, false);
    await manager.prepare('widget');

    await manager.invalidate('widget');

    expect(await exists(path.join(cache, 'widget'))).toBe(false);
  });
});
