import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { invalidatePluginComponentCache, loadPluginComponents } from './loadPluginComponents';
import { createServer } from '../../core/createServer';

import type { PluginEntry, SSRPageAdapters } from '@plitzi/sdk-shared';

let dir: string;

// A plugin on disk is a built ES module; what it exports does not have to be a real React component for the
// caching contract, only something whose identity we can read back.
const writePlugin = (file: string, marker: string): string => {
  const filePath = path.join(dir, file);
  writeFileSync(filePath, `export default function Plugin() { return '${marker}'; }\n`);

  return filePath;
};

/** A plugin that cannot evaluate on the server — the real failure this skip-list exists for: browser-only code
 *  reaching for `document`, which is a ReferenceError under Node. */
const writeBrowserOnlyPlugin = (file: string): string => {
  const filePath = path.join(dir, file);
  writeFileSync(filePath, 'export default document.body;\n');

  return filePath;
};

const entry = (filePath: string, keyName = 'demo'): PluginEntry => ({
  name: keyName,
  varName: keyName,
  keyName,
  filePath,
  props: {}
});

/** Reads back what the loaded plugin's component returns, or MISSING when the plugin was skipped. */
const markerOf = async (filePath: string, keyName = 'demo'): Promise<string> => {
  const loaded = await loadPluginComponents([entry(filePath, keyName)]);
  if (!(keyName in loaded)) {
    return 'MISSING';
  }

  return (loaded[keyName].component as unknown as () => string)();
};

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'plitzi-plugins-'));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('loadPluginComponents caching', () => {
  it('serves the same component on a second load without re-importing', async () => {
    const filePath = writePlugin('cached.mjs', 'v1');

    expect(await markerOf(filePath)).toBe('v1');

    // Rebuilt in place, exactly as a same-version plugin rebuild does.
    writePlugin('cached.mjs', 'v2');

    expect(await markerOf(filePath)).toBe('v1');
  });

  /** The regression this file exists for. Clearing the module-level Map is NOT enough on its own: Node's ESM
   *  registry caches a module by URL for the life of the process, so re-importing the same path hands back the
   *  module loaded before the rebuild. Invalidation has to change the URL too, and only this test can tell the
   *  difference — every other signal (the Map is empty, the file on disk is new) looks correct either way. */
  it('serves the rebuilt component after invalidation, re-reading from disk', async () => {
    const filePath = writePlugin('rebuilt.mjs', 'before');

    expect(await markerOf(filePath, 'rebuilt')).toBe('before');

    writePlugin('rebuilt.mjs', 'after');
    invalidatePluginComponentCache();

    expect(await markerOf(filePath, 'rebuilt')).toBe('after');
  });
});

describe('loadPluginComponents failure handling', () => {
  it('skips a plugin that throws on import and keeps skipping it', async () => {
    const filePath = writeBrowserOnlyPlugin('broken.mjs');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await markerOf(filePath, 'broken')).toBe('MISSING');
    expect(warn).toHaveBeenCalledOnce();

    // Second attempt must not retry: it is on the skip-list, so no new warning.
    expect(await markerOf(filePath, 'broken')).toBe('MISSING');
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
  });

  it('retries a previously failed plugin after invalidation', async () => {
    const filePath = writeBrowserOnlyPlugin('fixable.mjs');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(await markerOf(filePath, 'fixable')).toBe('MISSING');

    writePlugin('fixable.mjs', 'fixed');
    invalidatePluginComponentCache();

    expect(await markerOf(filePath, 'fixable')).toBe('fixed');

    warn.mockRestore();
  });
});

describe('loadPluginComponents inline components', () => {
  it('merges component-source plugins without touching the filesystem', async () => {
    const Inline = () => 'inline';
    const loaded = await loadPluginComponents([], { inline: Inline });

    expect(loaded.inline.component).toBe(Inline);
    expect(loaded.inline.props).toEqual({});
  });
});

/** The wiring, not the helper. A page server's `plugins.invalidate` has to clear BOTH sides — the plugin
 *  manager's own caches and the loaded components — because neither can reach the other. Dropping that second
 *  call would leave every test above passing while a real deployment served stale components after a rebuild. */
describe('page server plugin registry', () => {
  it('re-reads a rebuilt plugin after plugins.invalidate()', async () => {
    const adapters = {
      getOfflineData: () => Promise.resolve(undefined),
      getSpaceDeployment: () => Promise.resolve({ spaceId: 1, environment: 'main', revision: 0 })
    } as unknown as SSRPageAdapters;
    // Never listens: the registry is built by the factory, so the wiring is reachable without a socket. Nothing
    // to close either — and the cache sweep timers are unref'd, so they hold nothing open.
    const server = createServer({ adapters });

    const filePath = writePlugin('wired.mjs', 'stale');
    expect(await markerOf(filePath, 'wired')).toBe('stale');

    writePlugin('wired.mjs', 'rebuilt');
    await server.plugins.invalidate();

    expect(await markerOf(filePath, 'wired')).toBe('rebuilt');
  });
});
