import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';

import { emptySpace, noSpaceErrorCode } from '../helpers';
import { createMcpServer } from '../server';

import type { SSRAdapters, SSRGrant } from '@plitzi/sdk-shared';

/**
 * Which grant reaches a space. A site's credential — the `render` token every published page embeds, a self-hosting
 * `host` key — names a space too, but the draft, its history, its functions' source and its private data are not a
 * site's to read: only a member's `agent` grant attaches the space.
 */

const reading = () => {
  const read = vi.fn();
  const adapters: Partial<SSRAdapters> = {
    getSchema: () => {
      read('schema');

      return Promise.resolve(emptySpace().schema);
    },
    getStyle: () => Promise.resolve(emptySpace().style),
    getChanges: () => {
      read('changes');

      return Promise.resolve({ changes: [], nextBefore: null });
    },
    getData: () => {
      read('data');

      return Promise.resolve({ available: true, version: 'v', files: { 'secret.json': '{"key":1}' } });
    }
  };

  return { read, adapters };
};

const connect = async (grant: SSRGrant, adapters: Partial<SSRAdapters>) => {
  const server = await createMcpServer({ adapters, getGrant: () => Promise.resolve(grant) });
  const client = new Client({ name: 'test', version: '1' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

  return client;
};

const SITE_GRANTS: SSRGrant[] = [
  { spaceId: 9, scope: 'render', canWrite: false },
  { spaceId: 9, scope: 'host', canWrite: false }
];

describe('the grant a space is reached by', () => {
  it.each(SITE_GRANTS)('offers a $scope credential no tool that reads or writes the space', async grant => {
    const { adapters } = reading();
    const client = await connect(grant, adapters);

    const names = (await client.listTools()).tools.map(tool => tool.name);

    expect(names).toContain('plitzi_render');
    expect(names.filter(name => ['plitzi_apply', 'plitzi_search', 'plitzi_activity'].includes(name))).toEqual([]);
  });

  it.each(SITE_GRANTS)('reads nothing of the space for a $scope credential — its history, its data', async grant => {
    const { read, adapters } = reading();
    const client = await connect(grant, adapters);

    const answer = await client.callTool({
      name: 'plitzi_read',
      arguments: { uris: ['plitzi://changes/main', 'plitzi://data/main', 'plitzi://schema/main/pages'] }
    });

    expect(JSON.stringify(answer)).not.toContain('secret.json');
    expect(JSON.stringify(answer)).toContain(noSpaceErrorCode);
    await expect(client.readResource({ uri: 'plitzi://data/main' })).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });

  it('attaches the space to a member’s agent grant', async () => {
    const { read, adapters } = reading();
    const client = await connect({ spaceId: 9, scope: 'agent', userId: 4, canWrite: false }, adapters);

    const data = await client.readResource({ uri: 'plitzi://data/main' });

    expect(JSON.stringify(data)).toContain('secret.json');
    expect(read).toHaveBeenCalledWith('data');
  });
});
