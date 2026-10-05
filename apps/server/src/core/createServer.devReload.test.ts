import { afterEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_SCHEMA } from '@plitzi/sdk-shared/schema/schemaConstants';
import { EMPTY_STYLE_SCHEMA } from '@plitzi/sdk-shared/style/styleConstants';

import { createServer } from './createServer';
import { createJsonAdapters } from '../adapters/jsonAdapters';

import type { SSRServer } from '@plitzi/sdk-shared';

const PORT = 39318;
const BASE = `http://127.0.0.1:${PORT}`;

let server: SSRServer | undefined;

const start = async (options: { devMode: boolean; devReload?: boolean }): Promise<SSRServer> => {
  const started = createServer({
    port: PORT,
    ...options,
    adapters: createJsonAdapters({ offlineData: { schema: EMPTY_SCHEMA.schema, style: EMPTY_STYLE_SCHEMA } })
  });
  started.listen(PORT, '127.0.0.1');
  await vi.waitFor(async () => {
    expect((await fetch(`${BASE}/health`)).status).toBe(200);
  });
  server = started;

  return started;
};

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('reloadPages', () => {
  it('tells every page listening to load again', async () => {
    const running = await start({ devMode: true, devReload: true });
    const stream = await fetch(`${BASE}/__plitzi/reload`);
    expect(stream.headers.get('content-type')).toContain('text/event-stream');
    const reader = stream.body?.getReader();
    const decoder = new TextDecoder();
    let said = '';

    running.reloadPages();
    await vi.waitFor(async () => {
      const chunk = await reader?.read();
      said += decoder.decode(chunk?.value);
      expect(said).toContain('event: reload');
    });
    await reader?.cancel();
  });

  /** A page reconnecting to a server that restarted — its code changed under it — is told by a boot it has not seen. */
  it('greets every page with the boot of the process answering it, a new one after a restart', async () => {
    const boots: string[] = [];
    const greeting = async (): Promise<void> => {
      const stream = await fetch(`${BASE}/__plitzi/reload`);
      const reader = stream.body?.getReader();
      const decoder = new TextDecoder();
      let said = '';
      await vi.waitFor(async () => {
        const chunk = await reader?.read();
        said += decoder.decode(chunk?.value);
        expect(said).toContain('event: hello');
      });
      const data = /event: hello\ndata: (.*)\n/.exec(said)?.[1] ?? '{}';
      boots.push((JSON.parse(data) as { boot: string }).boot);
      await reader?.cancel();
    };

    await start({ devMode: true, devReload: true });
    await greeting();
    await greeting();
    await server?.close();
    await start({ devMode: true, devReload: true });
    await greeting();

    expect(boots[0]).toBe(boots[1]);
    expect(boots[2]).not.toBe(boots[0]);
  });

  it('is a page the template listens on only when asked for — a development server alone does not', async () => {
    await start({ devMode: true, devReload: true });
    const page = await (await fetch(`${BASE}/`)).text();
    expect(page).toContain('new EventSource(');
    expect(page).toContain('/__plitzi/reload');
    await server?.close();

    // Every open page would hold a connection for it: a server that never reloads pages must not hand that out.
    await start({ devMode: true });
    expect(await (await fetch(`${BASE}/`)).text()).not.toContain('/__plitzi/reload');
    expect((await fetch(`${BASE}/__plitzi/reload`)).headers.get('content-type')).not.toContain('text/event-stream');
  });
});
