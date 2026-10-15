import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';

import { emptySpace } from '../helpers';
import { createMcpServer } from '../server';

import type { SSRAdapters, SSRGrant } from '@plitzi/sdk-shared';
import type { ActivityReader, SpaceActivityPage, SpaceActivityQuery } from '@plitzi/sdk-shared/activity';

const PAGE: SpaceActivityPage = {
  activity: [
    {
      kind: 'change',
      at: 1,
      seq: 7,
      document: 'schema',
      author: { userId: 2, name: 'ana' },
      origin: 'builder',
      summary: 'Changed the content of text “hero”',
      touched: ['hero']
    }
  ],
  cursor: 'next',
  more: false,
  waitedMs: 12,
  skippedMine: 1
};

type Asked = { spaceId: number; query: SpaceActivityQuery; reader: ActivityReader; signal?: AbortSignal };

const connect = async (grant: SSRGrant, adapters: Partial<SSRAdapters>) => {
  const server = await createMcpServer({ adapters, getGrant: () => Promise.resolve(grant) });
  const client = new Client({ name: 'test', version: '1' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

  return client;
};

const textOf = (result: Awaited<ReturnType<Client['callTool']>>): unknown => {
  const [first] = result.content as { type: string; text: string }[];

  return JSON.parse(first.text);
};

const AGENT: SSRGrant = { spaceId: 9, scope: 'agent', userId: 4, canWrite: true };

describe('plitzi_activity', () => {
  const following = () => {
    const asked: Asked[] = [];
    const getSchema = vi.fn(() => Promise.resolve(emptySpace().schema));
    const adapters: Partial<SSRAdapters> = {
      getSchema,
      getStyle: () => Promise.resolve(emptySpace().style),
      getActivity: (spaceId, query, reader, signal) => {
        asked.push({ spaceId, query, reader, signal });

        return Promise.resolve(PAGE);
      }
    };

    return { asked, getSchema, adapters };
  };

  it('answers the page as the deployment read it, for the member the agent acts for', async () => {
    const { asked, adapters } = following();
    const client = await connect(AGENT, adapters);

    expect(textOf(await client.callTool({ name: 'plitzi_activity', arguments: { after: 'c1', wait: 5 } }))).toEqual(
      PAGE
    );
    expect(asked[0]).toMatchObject({
      spaceId: 9,
      query: { after: 'c1', wait: 5 },
      reader: { userId: 4, origin: 'mcp' }
    });
    expect(asked[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('waits the default after a cursor, and never on a first read, which has nothing to wait after', async () => {
    const { asked, adapters } = following();
    const client = await connect(AGENT, adapters);

    await client.callTool({ name: 'plitzi_activity', arguments: { after: 'c1' } });
    await client.callTool({ name: 'plitzi_activity', arguments: { wait: 30 } });

    expect(asked.map(each => each.query.wait)).toEqual([45, 0]);
  });

  it('reads none of the space’s documents: a wait does not load the whole space first', async () => {
    const { getSchema, adapters } = following();
    const client = await connect(AGENT, adapters);

    await client.callTool({ name: 'plitzi_activity', arguments: {} });

    expect(getSchema).not.toHaveBeenCalled();
  });

  it('is not offered to a site’s credential, which reaches no space', async () => {
    const { asked, adapters } = following();
    const client = await connect({ spaceId: 9, scope: 'render', canWrite: false }, adapters);

    expect((await client.listTools()).tools.map(tool => tool.name)).not.toContain('plitzi_activity');
    expect(asked).toHaveLength(0);
  });

  it('says so when the deployment keeps no activity', async () => {
    const { getActivity: _omitted, ...adapters } = following().adapters;
    const client = await connect(AGENT, adapters);

    expect(textOf(await client.callTool({ name: 'plitzi_activity', arguments: {} }))).toEqual({
      read: false,
      reason: 'This deployment keeps no activity for its spaces'
    });
  });

  it('refuses a wait past what every client and gateway in between holds a call for', async () => {
    const { adapters } = following();
    const client = await connect(AGENT, adapters);

    const result = await client.callTool({ name: 'plitzi_activity', arguments: { after: 'c1', wait: 120 } });

    expect(result.isError).toBe(true);
  });
});
