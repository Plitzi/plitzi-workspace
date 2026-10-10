import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PluginManager } from './manager';
import { configureServerLog } from '../helpers/serverLog';

import type { ServerLogEvent } from '@plitzi/sdk-shared';

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
describe('PluginManager across deployments', () => {
  /**
   * A new process — a deployment — finding last one's bundle in the cache folder. The version did not move; the code
   * did. Trusting the version served the old plugin, in production, where nothing else would ever notice.
   */
  it('builds again when the source changed under the same version, in production too', async () => {
    const { entry, component, cache } = await workspace();
    const sources = { widget: { js: entry, action: 'compile' as const, version: '1.0.0' } };

    await new PluginManager(sources, cache, 60_000, false).prepare('widget');
    expect(await bundle(cache, 'widget')).toContain('first');

    await fs.writeFile(component, 'export const widget = "second";\n');
    await new PluginManager(sources, cache, 60_000, false).prepare('widget');

    expect(await bundle(cache, 'widget')).toContain('second');
  });

  it('keeps the bundle a new process finds when nothing it was built from changed', async () => {
    const { entry, cache } = await workspace();
    const sources = { widget: { js: entry, action: 'compile' as const, version: '1.0.0' } };

    await new PluginManager(sources, cache, 60_000, false).prepare('widget');
    const built = await fs.stat(path.join(cache, 'widget', 'index.js'));
    await new PluginManager(sources, cache, 60_000, false).prepare('widget');

    expect((await fs.stat(path.join(cache, 'widget', 'index.js'))).mtimeMs).toBe(built.mtimeMs);
  });
});

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

describe('PluginManager sources a render names', () => {
  const cdn = (js: string) => ({ js, action: 'cdn' as const, version: '1.0.0' });

  it('keeps one source under one key, however often a render names it', () => {
    const manager = new PluginManager({}, undefined, 60_000, false);

    expect(manager.ensure('board', cdn('https://a.example/board.js'))).toBe(
      manager.ensure('board', cdn('https://a.example/board.js'))
    );
  });

  it('serves each space its own plugin when two share a name and a version', async () => {
    const manager = new PluginManager({}, undefined, 60_000, false);
    const mine = manager.ensure('board', cdn('https://a.example/board.js'));
    const theirs = manager.ensure('board', cdn('https://b.example/board.js'));

    expect(mine).not.toBe(theirs);
    expect((await manager.prepare(mine))?.js).toBe('https://a.example/board.js');
    expect((await manager.prepare(theirs))?.js).toBe('https://b.example/board.js');
  });

  it('serves a plugin published again under the same version from where it is now', async () => {
    const manager = new PluginManager({}, undefined, 60_000, false);
    manager.ensure('board', cdn('https://a.example/old/board.js'));
    const again = manager.ensure('board', cdn('https://a.example/new/board.js'));

    expect((await manager.getEntries([again]))[0]?.js).toBe('https://a.example/new/board.js');
    expect(again.replace(/@[^@]*$/, '')).toBe('board');
  });

  it('never answers for a bare name, which means a plugin this server was set up with', () => {
    const manager = new PluginManager({}, undefined, 60_000, false);
    manager.ensure('board', cdn('https://a.example/board.js'));

    expect(manager.hasPlugin('board')).toBe(false);
  });

  it('removes a release built for a render when that release is invalidated', async () => {
    const { entry, cache } = await workspace();
    const manager = new PluginManager({}, cache, 60_000, false);
    const key = manager.ensure('widget', { js: entry, action: 'compile', version: '1.0.0' });
    await manager.prepare(key);

    await manager.invalidate('widget', '1.0.0');

    await expect(fs.access(path.join(cache, key))).rejects.toThrow();
  });
});

/**
 * A project's terminal shows warnings and errors: a rebuild of bundles removed under the running server (`tmp/`
 * deleted by hand) said a warning per plugin and its "ready" at a level that terminal does not show, so it never said
 * it had finished.
 */
describe('PluginManager — bundles removed while it runs', () => {
  afterEach(() => {
    configureServerLog({ level: 'info' });
  });

  it('builds them again as one episode, said when noticed and when the last is built', async () => {
    const { dir, entry, cache } = await workspace();
    const other = path.join(dir, 'src', 'other.ts');
    await fs.writeFile(other, 'export const other = 1;\n');
    const manager = new PluginManager(
      {
        widget: { js: entry, action: 'compile', version: '1.0.0' },
        other: { js: other, action: 'compile', version: '1.0.0' }
      },
      cache,
      60_000,
      true
    );
    await manager.prepareAll();
    const said: ServerLogEvent[] = [];
    configureServerLog({ level: 'warn', logger: event => said.push(event) });

    await fs.rm(cache, { recursive: true, force: true });
    await manager.getEntries(['widget', 'other']);

    expect(await bundle(cache, 'widget')).toContain('first');
    await vi.waitFor(() => {
      expect(said.map(event => ('message' in event ? event.message : ''))).toEqual([
        expect.stringMatching(/^Plugin bundles missing from .*: building them again…$/),
        expect.stringMatching(/^Plugin bundles built again: 2 in \d+\.\ds$/)
      ]);
    });
  });
});
