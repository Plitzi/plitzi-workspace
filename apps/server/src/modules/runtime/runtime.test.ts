import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { inspectRuntime, loadRuntime, loadRuntimeModule, packRuntime } from './bundle';
import { defineRuntime } from './contract';
import { RUNTIME_DESCRIBE_PATH, startSpaceRuntime } from './host';
import { createRuntimeProxyStage } from './stages';
import { createJsonAdapters } from '../../adapters/jsonAdapters';
import { createServer } from '../../core/createServer';
import { createActionsModule } from '../actions';
import { ActionRefusal } from '../actions/runtime/errors';
import { createSigning } from '../actions/runtime/signing';
import { DEFAULT_FUNCTION_CEILINGS } from '../functions/config';
import { defineFunctions } from '../functions/contract';
import { readManifest } from '../functions/manifest';
import { createRemoteRunner } from '../functions/runner/remote';

import type { SpaceRuntimeDescription, SpaceRuntimeHost } from './host';
import type { SpaceFunctions } from '../functions/protocol';
import type { ActionEntry, ElementInteraction, OfflineDataRaw, Schema, SSRServer } from '@plitzi/sdk-shared';

/**
 * A space runtime beside the platform: its tasks run for the platform's flows with the platform's `ctx`, and its
 * endpoints answer the space's host through the page server — which keeps the visitor's session to itself.
 */

const SECRET = 'a-runtime-secret-that-is-32-chars-long';
const SIGNING_SECRET = 'the-platform-signing-secret-32-chars';
const RUNTIME_PORT = 39351;
const PAGE_PORT = 39352;

const runtime = defineRuntime({
  start: ({ env }) => ({
    functions: defineFunctions({
      tasks: [
        {
          namespace: 'board',
          action: 'open',
          title: 'Open',
          params: {},
          run: async (_params, ctx) => {
            const opened = await ctx.kv.change('opens', current => (typeof current === 'number' ? current : 0) + 1);
            if ((opened ?? 0) > 2) {
              throw new ActionRefusal('Too many tries — wait a little');
            }

            return { opened, key: await ctx.sign('owner:b1'), greeting: env.GREETING ?? '' };
          }
        }
      ]
    }),
    endpoints: {
      '/mcp': request =>
        new Response(
          new ReadableStream<Uint8Array>({
            start: controller => {
              const said = `cookie=${request.headers.get('cookie') ?? 'none'};auth=${request.headers.get('authorization') ?? 'none'}`;
              controller.enqueue(new TextEncoder().encode(`${said}\n`));
              const url = new URL(request.url);
              controller.enqueue(new TextEncoder().encode(`path=${url.pathname}${url.search}\n`));
              controller.close();
            }
          }),
          { headers: { 'content-type': 'text/plain', 'set-cookie': 'session=stolen' } }
        )
    }
  })
});

const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
  id,
  title: id,
  type: 'task',
  action: '',
  params: {},
  preview: {},
  elementId: null,
  beforeNode: '',
  afterNode: '',
  flowId: 'flow',
  enabled: true,
  ...overrides
});

const ENTRY: ActionEntry = {
  id: 'open',
  document: {
    name: 'Open',
    output: { value: { type: 'json' } },
    nodes: {
      start: node('start', { type: 'trigger', action: 'call', params: { access: 'public' }, afterNode: 'open' }),
      open: node('open', { action: 'board.open', afterNode: 'ret' }),
      ret: node('ret', { action: 'flow.output', params: { values: '{"value": {{ open|json_encode }}}' } })
    }
  }
};

const schema: Schema = {
  flat: {
    home: {
      id: 'home',
      attributes: { slug: '', folder: '', default: true },
      definition: { type: 'page', label: 'home', rootId: 'root', items: [], styleSelectors: { base: '' } }
    }
  },
  pages: ['home'],
  pageFolders: [],
  components: {},
  definition: { name: 'test', permanentUrl: 'test' },
  variables: [],
  settings: { customCss: '' }
};

let host: SpaceRuntimeHost;
// What the page server told of each request it forwarded — its runtime being used.
const forwarded: string[] = [];
let description: SpaceRuntimeDescription;
let page: SSRServer;

beforeAll(async () => {
  host = await startSpaceRuntime({
    runtime,
    secret: SECRET,
    port: RUNTIME_PORT,
    host: '127.0.0.1',
    env: { GREETING: 'hola' },
    publicUrl: `http://127.0.0.1:${String(PAGE_PORT)}`
  });
  const described = await fetch(`http://127.0.0.1:${String(RUNTIME_PORT)}${RUNTIME_DESCRIBE_PATH}`, {
    headers: { authorization: `Bearer ${SECRET}` }
  });
  description = (await described.json()) as SpaceRuntimeDescription;
  page = createServer(
    {
      port: PAGE_PORT,
      adapters: createJsonAdapters({ offlineData: { schema, style: {} } as unknown as OfflineDataRaw })
    },
    {
      data: [
        createRuntimeProxyStage({
          lookup: () =>
            Promise.resolve({
              url: `http://127.0.0.1:${String(RUNTIME_PORT)}`,
              secret: SECRET,
              endpoints: description.endpoints
            }),
          onForward: space => forwarded.push(space.endpoint)
        })
      ]
    }
  );
  page.listen(PAGE_PORT, '127.0.0.1');
});

afterAll(async () => {
  await page.close();
  await host.close();
});

describe('a space runtime', () => {
  it('says what it serves, to the platform alone', async () => {
    const stranger = await fetch(`http://127.0.0.1:${String(RUNTIME_PORT)}${RUNTIME_DESCRIBE_PATH}`);

    expect(stranger.status).toBe(401);
    expect(description.endpoints).toEqual(['/mcp']);
    expect(
      readManifest(description.functions, new Set(), DEFAULT_FUNCTION_CEILINGS).manifest.tasks.map(task => task.action)
    ).toEqual(['open']);
  });

  it('runs its tasks for the platform’s flows, with the platform’s store and key, and refuses as a step does', async () => {
    const functions: SpaceFunctions = {
      bundle: { id: 'runtime:3:main', load: () => Promise.reject(new Error('a runtime holds its own code')) },
      manifest: readManifest(description.functions, new Set(), DEFAULT_FUNCTION_CEILINGS).manifest,
      runner: createRemoteRunner({ url: `ws://127.0.0.1:${String(RUNTIME_PORT)}`, secret: SECRET })
    };
    const actions = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined), getFunctions: () => Promise.resolve(functions) },
      signingSecret: SIGNING_SECRET,
      jobs: false
    });
    const run = () =>
      actions.runAction({
        entry: ENTRY,
        input: {},
        callerId: 'ip:1',
        spaceId: 3,
        environment: 'main',
        trigger: 'call',
        runId: `run-${String(Math.random())}`
      });

    const first = await run();
    const second = await run();
    const third = await run();
    const { opened, key, greeting } = first.output.value as { opened: number; key: string; greeting: string };

    expect([opened, greeting, (second.output.value as { opened: number }).opened]).toEqual([1, 'hola', 2]);
    expect(await createSigning(SIGNING_SECRET)({ spaceId: 3, environment: 'main' }).verify('owner:b1', key)).toBe(true);
    expect(third.error).toBe('Too many tries — wait a little');
  });

  it('answers its endpoints on the space’s host, streamed, without the visitor’s session', async () => {
    const response = await fetch(`http://127.0.0.1:${String(PAGE_PORT)}/mcp/sessions?access-token=preview&page=2`, {
      headers: { cookie: 'plitzi_session=secret', authorization: 'Bearer visitor-token' }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.text()).toBe('cookie=none;auth=none\npath=/mcp/sessions?page=2\n');
    expect(forwarded).toContain('/mcp');
  });

  it('leaves the space’s other paths to the page server, and does not count them as the runtime used', async () => {
    const before = forwarded.length;
    const response = await fetch(`http://127.0.0.1:${String(PAGE_PORT)}/mcpish`);

    expect(await response.text()).not.toContain('cookie=');
    expect(forwarded).toHaveLength(before);
  });
});

describe('a packed runtime', () => {
  const work = path.resolve(import.meta.dirname, '../../../tmp/runtime-test');

  afterAll(() => fs.rm(work, { recursive: true, force: true }));

  it('travels with what it imports, and starts where it lands', async () => {
    await fs.mkdir(work, { recursive: true });
    await fs.writeFile(path.join(work, 'greeting.ts'), 'export const greet = (name: string) => `hola ${name}`;\n');
    await fs.writeFile(
      path.join(work, 'runtime.ts'),
      'import { greet } from "./greeting";\n' +
        'export default { start: ({ env }) => ({ close: async () => undefined, said: greet(env.NAME) }) };\n'
    );
    const loaded = await loadRuntime(await packRuntime(path.join(work, 'runtime.ts')), path.join(work, 'out'));

    expect(await loaded.start({ env: { NAME: 'Ana' }, publicUrl: 'http://x' })).toMatchObject({ said: 'hola Ana' });
  });

  it('is read without being run, and refused when it is not one', async () => {
    const bytes = await packRuntime(path.join(work, 'runtime.ts'));

    expect(inspectRuntime(bytes)).toEqual({ entry: 'runtime.mjs', files: ['runtime.mjs'] });
    expect(() => inspectRuntime(new Uint8Array([1, 2, 3]))).toThrow('not gzipped JSON');
  });

  it('is run from its module in a project of its own, and is nothing where the project has none', async () => {
    await fs.mkdir(path.join(work, 'module'), { recursive: true });
    await fs.writeFile(
      path.join(work, 'module/index.ts'),
      'export default { start: ({ env }) => ({ said: `hi ${String(env.NAME)}` }) };\n'
    );
    await fs.writeFile(path.join(work, 'module/not.ts'), 'export const start = () => ({});\n');

    const loaded = await loadRuntimeModule(path.join(work, 'module/index.ts'));
    expect(await loaded?.start({ env: { NAME: 'Ana' }, publicUrl: 'http://x' })).toMatchObject({ said: 'hi Ana' });
    expect(await loadRuntimeModule(path.join(work, 'module/missing.ts'))).toBeUndefined();
    await expect(loadRuntimeModule(path.join(work, 'module/not.ts'))).rejects.toThrow('exports its runtime by default');
  });

  it('is refused holding a file outside its own folder', async () => {
    const bytes = gzipSync(JSON.stringify({ format: 1, entry: '../escape.mjs', files: { '../escape.mjs': '' } }));

    await expect(loadRuntime(new Uint8Array(bytes), path.join(work, 'evil'))).rejects.toThrow('not a file');
  });
});

/**
 * A runtime stopped while it is being listened to — an agent's stream open through the platform, the platform's own
 * connection held — still stops: what never ends by itself is ended, so whatever is stopping it is never left waiting.
 */
describe('a space runtime being stopped', () => {
  const PORT = 39353;

  it('stops with a stream still open on it', async () => {
    const listening = defineRuntime({
      start: () => ({
        endpoints: {
          '/mcp': () =>
            // Open, said once, and never ended — an agent's app listening.
            new Response(
              new ReadableStream<Uint8Array>({
                start: controller => controller.enqueue(new TextEncoder().encode(': open\n\n'))
              }),
              { headers: { 'content-type': 'text/event-stream' } }
            )
        }
      })
    });
    const stopping = await startSpaceRuntime({
      runtime: listening,
      secret: SECRET,
      port: PORT,
      host: '127.0.0.1',
      env: {},
      publicUrl: 'http://127.0.0.1'
    });
    const stream = await fetch(`http://127.0.0.1:${String(PORT)}/mcp`, {
      headers: { authorization: `Bearer ${SECRET}`, accept: 'text/event-stream' }
    });
    expect(stream.status).toBe(200);

    const stopped = await Promise.race([
      stopping.close().then(() => 'stopped'),
      new Promise(resolve => setTimeout(() => resolve('still waiting'), 5000))
    ]);

    expect(stopped).toBe('stopped');
  });
});
