import { tasksOf } from '../../../functions/tests/tasksOf';
import { createActionsModule } from '../../module';
import { createMemoryJobQueue } from '../memoryQueue';
import { createJobWorker } from '../worker';

import type { ActionEntry, JobInput, ElementInteraction } from '@plitzi/sdk-shared';
import type { FunctionTask } from '@plitzi/sdk-shared/functions';

/**
 * What the job worker's tests share: a space's action, a job of it, and a world of one queue and one module whose task
 * the test drives.
 */

export const node = (id: string, overrides: Partial<ElementInteraction> = {}): ElementInteraction => ({
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

export const entry = (id = 'digest'): ActionEntry => ({
  id,
  document: {
    name: id,
    nodes: {
      start: node('start', { type: 'trigger', action: 'schedule', params: { cron: '* * * * *' }, afterNode: 'work' }),
      work: node('work', { action: 'test.work', afterNode: '' })
    }
  }
});

/** A process with all its CPU free: what the tests run as unless they say otherwise, whatever the machine is doing. */
export const idle = () => ({ cpuCores: 0, cpuShare: 0, lagMs: 0 });

export const MIDNIGHT = Date.parse('2026-03-01T00:00:00Z');

export const jobInput = (over: Partial<JobInput> = {}): JobInput => ({
  id: `schedule:1:digest:${MIDNIGHT}`,
  spaceId: 1,
  environment: 'main',
  target: { kind: 'action', name: 'digest', trigger: 'schedule' },
  input: {},
  dueAt: MIDNIGHT,
  maxAttempts: 3,
  ...over
});

/** One queue, one module, and a task the test drives — the module's ceilings as `concurrency` says. */
export const world = (
  run: FunctionTask['run'],
  entries = [entry()],
  concurrency?: Parameters<typeof createActionsModule>[0]['concurrency']
) => {
  let now = MIDNIGHT;
  const queue = createMemoryJobQueue({ clock: () => now });
  const lookups = {
    getAction: (_spaceId: number, actionId: string) => Promise.resolve(entries.find(item => item.id === actionId)),
    listActions: () => Promise.resolve(entries)
  };
  const task: FunctionTask = { namespace: 'test', action: 'work', title: 'Work', params: {}, run };
  // `jobs: false` so the module builds no scheduler of its own; the test drives the worker directly.
  const module = createActionsModule({
    lookups,
    functions: tasksOf(task),
    jobs: false,
    ...(concurrency ? { concurrency } : {})
  });

  return {
    queue,
    module,
    lookups,
    advance: (ms: number) => {
      now += ms;
    },
    worker: (over: Parameters<typeof createJobWorker>[0] extends infer T ? Partial<T> : never = {}) =>
      createJobWorker({
        queue,
        lookups,
        module,
        pollMs: 5,
        leaseMs: 1_000,
        onError: () => {},
        readLoad: idle,
        ...over
      }),
    job: async (over: Partial<JobInput> = {}) => {
      await queue.enqueue(jobInput(over));
    },
    read: async (id = jobInput().id) => {
      const job = await queue.getJob([1], id);
      if (!job) {
        throw new Error(`no job ${id}`);
      }

      return job;
    }
  };
};

/** Lets whatever the worker started settle: it deliberately does not await the runs it begins. */
export const settle = async (): Promise<void> => {
  for (let pass = 0; pass < 40; pass += 1) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};
