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
import { unusedPort } from '../../core/unusedPort';
import { createActionsModule } from '../actions';
import { createMemoryJobQueue } from '../actions/jobs/memoryQueue';
import { ActionRefusal } from '../actions/runtime/errors';
import { createSigning } from '../actions/runtime/signing';
import { DEFAULT_FUNCTION_CEILINGS } from '../functions/config';
import { defineFunctions } from '../functions/contract';
import { readManifest } from '../functions/manifest';
import { createRemoteRunner } from '../functions/runner/remote';
import { offlineDataOf } from '../ssr/tests/offlineData';

import type { SpaceRuntimeDescription, SpaceRuntimeHost } from './host';
import type { SpaceFunctions } from '../functions/protocol';
import type { ActionEntry, ElementInteraction, SSRServer } from '@plitzi/sdk-shared';

/**
 * A space runtime beside the platform: its tasks run for the platform's flows with the platform's `ctx`, and its
 * endpoints answer the space's host through the page server — which keeps the visitor's session to itself.
 */

const SECRET = 'a-runtime-secret-that-is-32-chars-long';
const SIGNING_SECRET = 'the-platform-signing-secret-32-chars';
const RUNTIME_PORT = await unusedPort();
const PAGE_PORT = await unusedPort();

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
      ],
      routes: {
        // A stream written over time, with the platform's ctx: what an endpoint did, as a route under /fn/.
        'GET /ticks': async (_request, ctx) => {
          const opened = await ctx.kv.increment('ticks-opened', 1);

          return new Response(
            new ReadableStream<Uint8Array>({
              start: async controller => {
                controller.enqueue(new TextEncoder().encode(`tick 1 of ${String(opened)}\n`));
                await new Promise(resolve => setTimeout(resolve, 150));
                controller.enqueue(new TextEncoder().encode('tick 2\n'));
                controller.close();
              }
            }),
            { headers: { 'content-type': 'text/plain', 'set-cookie': 'session=stolen' } }
          );
        }
      },
      jobs: {
        // Long by design: it runs until it is told why to stop, and says it saw why in what it saves.
        train: {
          run: async (_input, job) => {
            let epoch = (job.state as { epoch?: number } | undefined)?.epoch ?? 0;
            while (!job.signal.aborted && epoch < 20) {
              epoch += 1;
              await job.save({ epoch, resumed: job.state !== undefined });
              await new Promise(resolve => setTimeout(resolve, 20));
            }

            if (job.stopping) {
              await job.save({ epoch, stopping: job.stopping });

              return null;
            }

            return { epochs: epoch };
          }
        }
      }
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
      adapters: createJsonAdapters({ offlineData: offlineDataOf() })
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
  await page.listen(PAGE_PORT, '127.0.0.1');
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

  it('runs a job in its own process, held only by the lease, told why to stop, and going on from what it saved', async () => {
    const functions: SpaceFunctions = {
      bundle: { id: 'runtime:3:main', load: () => Promise.reject(new Error('a runtime holds its own code')) },
      manifest: readManifest(description.functions, new Set(), DEFAULT_FUNCTION_CEILINGS).manifest,
      runner: createRemoteRunner({ url: `ws://127.0.0.1:${String(RUNTIME_PORT)}`, secret: SECRET })
    };
    const queue = createMemoryJobQueue();
    const actions = createActionsModule({
      lookups: {
        getAction: () => Promise.resolve(undefined),
        listActions: () => Promise.resolve([]),
        getFunctions: () => Promise.resolve(functions)
      },
      jobs: { queue, leaseMs: 60_000 }
    });
    const worker = actions.jobs?.worker;
    if (!worker) {
      throw new Error('The module runs no jobs');
    }

    // A slice in the sandbox would end after 50 ms; one in a runtime runs on, its lease what holds it.
    const at = Date.now();
    await queue.enqueue({
      id: 'job:3:train',
      spaceId: 3,
      environment: 'main',
      target: { kind: 'function', name: 'train' },
      input: {},
      dueAt: at,
      maxAttempts: 3
    });
    await worker.poll();
    await new Promise(resolve => setTimeout(resolve, 120));
    expect(await queue.pause([3], 'job:3:train')).toBe(true);
    await worker.beat();
    const settledOf = async (status: string) => {
      for (let round = 0; round < 100; round += 1) {
        const job = await queue.getJob([3], 'job:3:train');
        if (job?.status === status) {
          return job;
        }

        await worker.poll();
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      throw new Error(`The job never became ${status}`);
    };
    const paused = await settledOf('paused');
    expect(paused.state).toMatchObject({ stopping: 'pause' });
    const epoch = (paused.state as { epoch: number }).epoch;
    expect(epoch).toBeGreaterThan(1);

    await queue.resume([3], 'job:3:train');
    const done = await settledOf('succeeded');
    expect(done.result).toEqual({ epochs: 20 });
    expect(done.state).toMatchObject({ epoch: 20, resumed: true });
    expect(done.attempts).toBe(1);
  });

  it('streams a route under /fn/ as it is written, with the platform’s ctx, and none of its cookies', async () => {
    const functions: SpaceFunctions = {
      bundle: { id: 'runtime:3:main', load: () => Promise.reject(new Error('a runtime holds its own code')) },
      manifest: readManifest(description.functions, new Set(), DEFAULT_FUNCTION_CEILINGS).manifest,
      runner: createRemoteRunner({ url: `ws://127.0.0.1:${String(RUNTIME_PORT)}`, secret: SECRET })
    };
    const port = await unusedPort();
    const platform = createServer({
      port,
      adapters: createJsonAdapters({ offlineData: offlineDataOf() }),
      action: {
        lookups: { getAction: () => Promise.resolve(undefined), getFunctions: () => Promise.resolve(functions) },
        jobs: false
      }
    });
    await platform.listen(port, '127.0.0.1');
    try {
      const answer = await fetch(`http://127.0.0.1:${String(port)}/fn/ticks`);
      expect(answer.status).toBe(200);
      expect(answer.headers.get('set-cookie')).toBeNull();
      expect(answer.headers.get('cache-control')).toBe('no-store');

      const reader = answer.body?.getReader();
      if (!reader) {
        throw new Error('The route answered no body');
      }

      const decoder = new TextDecoder();
      const first = await reader.read();
      const firstAt = Date.now();
      let rest = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        rest += decoder.decode(value);
      }

      // The first tick was here before the second was written: passed on as it came, not once it ended.
      expect(decoder.decode(first.value)).toBe('tick 1 of 1\n');
      expect(Date.now() - firstAt).toBeGreaterThanOrEqual(100);
      expect(rest).toBe('tick 2\n');
    } finally {
      await platform.close();
    }
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
      port: 0,
      host: '127.0.0.1',
      env: {},
      publicUrl: 'http://127.0.0.1'
    });
    const stream = await fetch(`http://127.0.0.1:${String(stopping.address().port)}/mcp`, {
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
