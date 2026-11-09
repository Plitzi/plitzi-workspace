import { afterEach, describe, expect, it, vi } from 'vitest';

import { unusedPort } from '@plitzi/sdk-kernel/http';
import { RUNTIME_DESCRIBE_PATH } from '@plitzi/sdk-shared/functions';

import { startSpaceRuntime } from './host';
import { defineRuntime } from '../contract/runtime';

import type { SpaceRuntimeDescription, SpaceRuntimeHost } from './host';
import type { SpaceRuntimeParts } from '@plitzi/sdk-shared/functions';

const SECRET = 'the-platform-and-this-runtime-alone';
const PUBLIC_URL = 'https://space.example.com';

let started: SpaceRuntimeHost | undefined;

afterEach(async () => {
  await started?.close();
  started = undefined;
});

/** A runtime made of these parts, started on a port of its own; answers where to reach it. */
const start = async (parts: SpaceRuntimeParts): Promise<string> => {
  const port = await unusedPort();
  started = await startSpaceRuntime({
    runtime: defineRuntime({ start: () => parts }),
    secret: SECRET,
    port,
    host: '127.0.0.1',
    env: {},
    publicUrl: PUBLIC_URL
  });

  return `http://127.0.0.1:${String(port)}`;
};

const asPlatform = { authorization: `Bearer ${SECRET}` };

describe('a space runtime, started', () => {
  it('says what it serves to the platform, and to nobody else', async () => {
    const base = await start({ endpoints: { '/mcp': () => new Response('') } });

    expect((await fetch(`${base}${RUNTIME_DESCRIBE_PATH}`)).status).toBe(401);

    const described = await fetch(`${base}${RUNTIME_DESCRIBE_PATH}`, { headers: asPlatform });
    expect(described.status).toBe(200);
    // The body is the description this host wrote: `json()` cannot know its type.
    const { endpoints } = (await described.json()) as SpaceRuntimeDescription;
    expect(endpoints).toEqual(['/mcp']);
  });

  it('answers what is beneath an endpoint, without the headers the platform presents', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const base = await start({
      endpoints: {
        '/mcp': request => {
          seen.push({ url: request.url, headers: Object.fromEntries(request.headers) });

          return new Response('answered', { status: 202 });
        }
      }
    });

    const answer = await fetch(`${base}/mcp/tools?x=1`, {
      headers: { ...asPlatform, cookie: 'session=the-visitor', 'x-trace': 'kept' }
    });

    expect(answer.status).toBe(202);
    expect(await answer.text()).toBe('answered');
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toBe(`${PUBLIC_URL}/mcp/tools?x=1`);
    expect(seen[0].headers['x-trace']).toBe('kept');
    expect(seen[0].headers).not.toHaveProperty('authorization');
    expect(seen[0].headers).not.toHaveProperty('cookie');
  });

  it('answers 404 for a path no endpoint holds', async () => {
    const base = await start({ endpoints: { '/mcp': () => new Response('') } });

    expect((await fetch(`${base}/mcpx`, { headers: asPlatform })).status).toBe(404);
  });

  it('refuses an endpoint on a path of the server’s before serving, and closes what it started', async () => {
    const close = vi.fn(() => Promise.resolve());
    const runtime = defineRuntime({
      start: () => ({ endpoints: { '/fn/feed': () => new Response(''), '/_admin': () => new Response('') }, close })
    });

    await expect(
      startSpaceRuntime({ runtime, secret: SECRET, port: await unusedPort(), env: {}, publicUrl: PUBLIC_URL })
    ).rejects.toThrow('"/fn/feed" is the server\'s own (/fn): an endpoint takes a path of the space\'s; "/_admin"');
    expect(close).toHaveBeenCalledTimes(1);
  });
});
