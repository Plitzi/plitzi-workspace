import http from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServer } from '../../../createServer';
import { emptySpace } from '../helpers';

import type { SSRAdapters, SSRServer } from '@plitzi/sdk-shared';

// An ephemeral port, claimed by probing one with a throwaway listener.
const freePort = (): Promise<number> =>
  new Promise(resolve => {
    const probe = http.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });

const post = (port: number, body: unknown): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }
      },
      res => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => resolve(JSON.parse(data) as unknown));
      }
    );
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });

const call = (id: number) => ({
  jsonrpc: '2.0',
  id,
  method: 'tools/call',
  params: { name: 'plitzi_describe_operation', arguments: { op: 'element.add' } }
});

// A deployment may cap the tool calls its MCP answers (`admitToolCalls`): a refused call reads the refusal as its
// result, so the agent says why instead of reporting a server that went away.
describe('admitting tool calls', () => {
  const asked: number[] = [];
  let refuse = false;
  let server: SSRServer;
  let port: number;

  beforeAll(async () => {
    const space = emptySpace();
    const adapters = {
      getGrant: () => Promise.resolve({ spaceId: 1, scope: 'agent' as const, canWrite: false }),
      getSchema: () => Promise.resolve(space.schema),
      getStyle: () => Promise.resolve(space.style),
      admitToolCalls: (_req: unknown, calls: number) => {
        asked.push(calls);

        return Promise.resolve(refuse ? { error: 'This workspace has made its 300 tool calls today.' } : undefined);
      }
    } as unknown as SSRAdapters;
    port = await freePort();
    server = createServer({ httpVersion: 1, adapters });
    await server.listen(port, '127.0.0.1');
  });

  afterAll(async () => {
    await server.close();
  });

  it('asks before a call runs, and not for a request that makes none', async () => {
    await post(port, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(asked).toEqual([]);

    const answer = (await post(port, call(2))) as { result?: { isError?: boolean } };
    expect(asked).toEqual([1]);
    expect(answer.result?.isError).not.toBe(true);
  });

  it('answers a refused call with the refusal as its result', async () => {
    refuse = true;

    expect(await post(port, call(3))).toEqual({
      jsonrpc: '2.0',
      id: 3,
      result: { content: [{ type: 'text', text: 'This workspace has made its 300 tool calls today.' }], isError: true }
    });
  });
});
