import { afterEach, describe, expect, it, vi } from 'vitest';

import { reportMissingPlugins } from './reportMissingPlugins';
import { configureServerLog } from '../../helpers/serverLog';

import type { Schema, ServerLogEvent, ServerLogger } from '@plitzi/sdk-shared';

const schema = (custom: Record<string, unknown>): Schema => ({
  flat: {
    home: {
      id: 'home',
      attributes: { slug: '', folder: '', default: true },
      definition: { type: 'page', label: 'home', rootId: 'root', items: ['card'], styleSelectors: { base: '' } }
    },
    card: {
      id: 'card',
      attributes: custom,
      definition: {
        type: 'custom',
        label: 'card',
        rootId: 'home',
        parentId: 'home',
        items: [],
        styleSelectors: { base: '' }
      }
    }
  },
  pages: ['home'],
  pageFolders: [],
  definition: { name: 'test', permanentUrl: 'test' },
  variables: [],
  settings: { customCss: '' }
});

const messages = (sink: ReturnType<typeof vi.fn<ServerLogger>>): string[] =>
  sink.mock.calls.map(([event]: [ServerLogEvent]) => (event.kind === 'message' ? event.message : ''));

afterEach(() => {
  configureServerLog({ level: 'info' });
});

describe('reportMissingPlugins', () => {
  it('says which plugin a space renders that the server has nothing for, and how to supply it', () => {
    const sink = vi.fn<ServerLogger>();
    configureServerLog({ level: 'error', logger: sink });

    reportMissingPlugins(101, schema({ renderType: 'statCard' }), new Set());

    expect(messages(sink)).toEqual([expect.stringContaining('"statCard" (element "card")')]);
    expect(messages(sink)[0]).toContain('pluginNames');
  });

  it('says it once per space and type, not on every render', () => {
    const sink = vi.fn<ServerLogger>();
    configureServerLog({ level: 'error', logger: sink });

    reportMissingPlugins(102, schema({ renderType: 'statCard' }), new Set());
    reportMissingPlugins(102, schema({ renderType: 'statCard' }), new Set());

    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('is quiet when the server has the plugin, or the element loads its own script', () => {
    const sink = vi.fn<ServerLogger>();
    configureServerLog({ level: 'error', logger: sink });

    reportMissingPlugins(103, schema({ renderType: 'statCard' }), new Set(['statCard']));
    reportMissingPlugins(
      104,
      schema({ renderType: 'remote', isPlugin: true, scriptUrl: 'https://cdn.example.com/remote.js' }),
      new Set()
    );
    reportMissingPlugins(105, schema({ renderType: '' }), new Set());

    expect(sink).not.toHaveBeenCalled();
  });
});
