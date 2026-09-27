import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerExternalPlugins } from './registerExternalPlugins';

import type { PluginManager } from '../../plugins/manager';
import type { OfflineDataRaw } from '@plitzi/sdk-shared';

/**
 * A plugin's `resource` is written by whoever edits the space, and its manifest is fetched from here — from inside the
 * cluster. It answers to the same outbound rule as every other request somebody else authored.
 */

const pluginManager = () =>
  ({
    outputDir: mkdtempSync(path.join(tmpdir(), 'ext-plugins-')),
    ensure: vi.fn((type: string) => Promise.resolve(type))
  }) as unknown as PluginManager;

const spaceWith = (resource: string) =>
  ({ schema: {}, style: {}, plugins: [{ type: 'widget', resource }] }) as unknown as OfflineDataRaw;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('registerExternalPlugins', () => {
  it('never fetches a manifest from inside the cluster', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    for (const resource of ['http://127.0.0.1:6379/plugin', 'http://[::ffff:169.254.169.254]/plugin']) {
      expect(await registerExternalPlugins(pluginManager(), spaceWith(resource)), resource).toEqual([]);
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registers a plugin published on a public host', async () => {
    const manifest = { version: '1.0.0', assets: { main: { type: 'script', isMain: true, src: 'widget.mjs' } } };
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.resolve(Response.json(manifest)))
    );

    const manager = pluginManager();

    expect(await registerExternalPlugins(manager, spaceWith('https://93.184.216.34/widget/1.0.0'))).toEqual(['widget']);
  });
});
