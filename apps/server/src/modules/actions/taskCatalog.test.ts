import { describe, expect, it } from 'vitest';

import { createActionsModule } from './index';
import { describeCatalog, describeTask } from './taskCatalog';

import type { ActionTask } from './types';

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
    const task = { namespace: 'x', action: 'y', title: 'Y', params: {}, run: () => ({}) } as ActionTask<never>;
    const { registry: withCustom } = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined) },
      tasks: [task]
    });
    const registered = withCustom.get('x.y');
    const described = describeTask(registered as NonNullable<typeof registered>);

    expect('run' in described).toBe(false);
  });
});
