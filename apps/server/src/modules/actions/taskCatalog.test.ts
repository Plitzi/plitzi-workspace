import { describe, expect, it } from 'vitest';

import { createActionsModule } from './index';
import { describeCatalog, describeTask } from './taskCatalog';
import { createSpaceRegistries } from '../functions/space';
import { tasksOf } from '../functions/testing/tasksOf';

import type { FunctionTask } from '../functions/contract';
import type { FunctionRunner } from '../functions/protocol';

const registry = () => createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } }).registry;

describe('task catalog', () => {
  // The regression: `http.request` hides its body on GET with a function, and a JSON scalar refuses a function
  // outright — so one task with a conditional field took the whole catalog down with it.
  it('serializes, functions and all', () => {
    expect(() => JSON.stringify(describeCatalog(registry()))).not.toThrow();
  });

  it('drops the function half of a conditional param but keeps the field', () => {
    const http = describeCatalog(registry()).find(task => task.name === 'http.request');

    expect(http?.params.body).toBeDefined();
    expect((http?.params.body as Record<string, unknown>).when).toBeUndefined();
    expect((http?.params.body as Record<string, unknown>).type).toBe('codemirror-json');
  });

  it('keeps static options, which are the common case', () => {
    const http = describeCatalog(registry()).find(task => task.name === 'http.request');
    const method = http?.params.method as { options: { value: string }[] };

    expect(method.options.map(option => option.value)).toContain('POST');
  });

  it('never carries the task’s code', () => {
    const task = { namespace: 'x', action: 'y', title: 'Y', params: {}, run: () => ({}) } as FunctionTask<never>;
    const { registry: withCustom } = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined) },
      functions: tasksOf(task)
    });
    const registered = withCustom.get('x.y');
    const described = describeTask(registered as NonNullable<typeof registered>);

    expect('run' in described).toBe(false);
  });

  /** The editor lists them apart: the platform's steps, and the ones the space wrote. */
  it('says whose each task is: the deployment’s, or the space’s own functions’', () => {
    const runner: FunctionRunner = { describe: () => Promise.resolve({}), invoke: () => Promise.resolve(null) };
    const spaceRegistry = createSpaceRegistries(registry(), { runner }).registryFor({
      bundle: { id: 'b1', load: () => Promise.resolve('') },
      manifest: {
        hosts: [],
        routes: [],
        tasks: [{ namespace: 'seismic', action: 'feed', title: 'Seismic Feed', params: {} }]
      }
    });
    const catalog = describeCatalog(spaceRegistry);

    expect(catalog.find(task => task.name === 'http.request')?.origin).toBe('deployment');
    expect(catalog.find(task => task.name === 'seismic.feed')?.origin).toBe('space');
  });
});
