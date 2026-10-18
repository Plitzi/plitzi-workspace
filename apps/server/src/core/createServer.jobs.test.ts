import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createServer } from './createServer';
import { unusedPort } from './unusedPort';
import { createJsonAdapters } from '../adapters/jsonAdapters';
import { createActionsModule } from '../modules/actions';
import { createMemoryJobQueue } from '../modules/actions/jobs/memoryQueue';
import { createIsolateRunner } from '../modules/functions/sandbox/isolate';
import { functionsInHand } from '../modules/functions/space';
import { offlineDataOf } from '../modules/ssr/testing/offlineData';

import type { SpaceFunctions } from '../modules/functions/protocol';
import type { Job, FunctionJobView, SSRServer } from '@plitzi/sdk-shared';

/**
 * A space's job the whole way, through the server a deployment gets: its code in the sandbox declares it, a route starts
 * it, the server's own worker runs it in slices of a third of a second — each going on from what the one before saved —
 * and a page watches it on `$job:<id>`, let in by the job's `watch`.
 */

const PORT = await unusedPort();
const BASE = `http://127.0.0.1:${String(PORT)}`;

const SPACE_SOURCE = {
  'index.ts': `export default {
  jobs: {
    count: {
      watch: { mode: 'public' },
      run: async (input, job, ctx) => {
        await ctx.kv.increment('slices', 1);
        let at = job.state?.at ?? 0;
        while (at < input.to) {
          if (job.signal.aborted) {
            await ctx.kv.set('saw', job.stopping);
            return;
          }

          at += 1;
          await job.save({ at });
          job.report(at / input.to, 'step ' + at);
          await new Promise(resolve => setTimeout(resolve, 60));
        }
        return { at };
      }
    },
    quiet: {
      run: async (input, job) => {
        await new Promise(resolve => {
          const timer = setTimeout(resolve, 5000);
          job.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); });
        });
        return job.stopping;
      }
    },
    mine: { run: async () => 'only mine' }
  },
  routes: {
    'POST /start/:name': async (request, ctx) => Response.json(await ctx.jobs.start(ctx.params.name, await request.json())),
    'GET /jobs/:id': async (request, ctx) => Response.json((await ctx.jobs.get(ctx.params.id)) ?? null),
    'GET /slices': async (request, ctx) => Response.json({ slices: await ctx.kv.get('slices'), saw: await ctx.kv.get('saw') })
  }
};`
};

const queue = createMemoryJobQueue();
let server: SSRServer;

beforeAll(async () => {
  const runner = createIsolateRunner();
  const prepared = await createActionsModule({
    lookups: { getAction: () => Promise.resolve(undefined) },
    functions: { runner }
  }).prepareFunctions(SPACE_SOURCE);
  if (!prepared.ok) {
    throw new Error(prepared.problems.map(problem => problem.message).join('\n'));
  }

  const functions: SpaceFunctions = functionsInHand(prepared.functions);
  server = createServer({
    port: PORT,
    adapters: createJsonAdapters({ offlineData: offlineDataOf() }),
    action: {
      lookups: {
        getAction: () => Promise.resolve(undefined),
        listActions: () => Promise.resolve([]),
        getFunctions: () => Promise.resolve(functions)
      },
      jobs: { queue, pollMs: 20, maxAttempts: 1 }
    },
    functions: { runner, jobs: { limitsFor: () => Promise.resolve({ sliceMs: 300 }) } }
  });
  await server.listen(PORT, '127.0.0.1');
});

afterAll(async () => {
  await server.close();
});

const start = async (name: string, input: Record<string, unknown> = {}): Promise<FunctionJobView> =>
  (await (
    await fetch(`${BASE}/fn/start/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    })
  ).json()) as FunctionJobView;

const until = async (id: string, done: (job: Job) => boolean): Promise<Job> => {
  for (let round = 0; round < 300; round += 1) {
    const job = await queue.getJob([1], id);
    if (job && done(job)) {
      return job;
    }

    await new Promise(resolve => setTimeout(resolve, 20));
  }

  throw new Error(`Job ${id} never got there: ${JSON.stringify(await queue.getJob([1], id))}`);
};

/** What a page hears on `topics` within `ms`: the stream's events, parsed. */
const listen = async (
  topics: string,
  ms: number
): Promise<{ status: number; events: { event: string; data: unknown }[] }> => {
  const controller = new AbortController();
  const answer = await fetch(`${BASE}/_realtime?topics=${encodeURIComponent(topics)}`, { signal: controller.signal });
  if (!answer.body || answer.status !== 200) {
    return { status: answer.status, events: [] };
  }

  const reader = answer.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  const stop = setTimeout(() => controller.abort(), ms);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      text += decoder.decode(value);
    }
  } catch {
    // The page went away: what it heard is what it has.
  } finally {
    clearTimeout(stop);
  }

  return {
    status: answer.status,
    events: text
      .split('\n\n')
      .filter(chunk => chunk.startsWith('event: '))
      .map(chunk => {
        const [eventLine = '', dataLine = ''] = chunk.split('\n');

        return { event: eventLine.slice(7), data: JSON.parse(dataLine.slice(6)) as unknown };
      })
  };
};

describe('a space’s job through the server', () => {
  it('runs slice after slice, each going on from what the one before saved, to its answer', async () => {
    const { id, status } = await start('count', { to: 10 });
    expect(status).toBe('pending');

    const job = await until(id, each => each.status === 'succeeded');
    expect(job.result).toEqual({ at: 10 });
    expect(job.attempts).toBe(1);
    expect(job.activeMs).toBeGreaterThanOrEqual(500);
    const { slices, saw } = (await (await fetch(`${BASE}/fn/slices`)).json()) as { slices: number; saw: string };
    expect(slices).toBeGreaterThan(1);
    // What the slice was told as it was cut: its time in one go was up.
    expect(saw).toBe('limit');
    expect(await (await fetch(`${BASE}/fn/jobs/${id}`)).json()).toMatchObject({
      status: 'succeeded',
      result: { at: 10 },
      progress: 1,
      step: 'step 10'
    });
  });

  it('fails a slice cut by its time that saved nothing, rather than run it again forever', async () => {
    const { id } = await start('quiet');
    const job = await until(id, each => each.status === 'dead');

    expect(job.error).toBe(
      'its slice ran out of time without saving progress — job.save where it is, to go on in the next one'
    );
  });

  it('lets a page watch a job its `watch` opens — and hands the latest to one that joins late', async () => {
    const { id } = await start('count', { to: 3 });
    await until(id, each => each.status === 'succeeded');
    const { status, events } = await listen(`$job:${id}`, 300);

    expect(status).toBe(200);
    expect(events.find(each => each.event === 'message')?.data).toMatchObject({
      topic: `$job:${id}`,
      type: 'job',
      retained: true,
      data: { id, name: 'count', status: 'succeeded', result: { at: 3 } }
    });
  });

  it('keeps a job without `watch` from anybody but whoever started it, and a job nobody started from all', async () => {
    const { id } = await start('mine');
    await until(id, each => each.status === 'succeeded');

    expect((await listen(`$job:${id}`, 100)).status).toBe(403);
    expect((await listen('$job:job:1:nobody', 100)).status).toBe(403);
  });
});
