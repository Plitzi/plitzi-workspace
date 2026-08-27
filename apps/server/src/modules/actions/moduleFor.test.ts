import { describe, expect, it } from 'vitest';

import { actionsModuleFor } from './moduleFor';

import type { SSRPageServerConfig } from '@plitzi/sdk-shared';

const lookups = { getAction: () => Promise.resolve(undefined) };

const configWith = (action: Record<string, unknown>): SSRPageServerConfig =>
  ({ action: { lookups, ...action } }) as unknown as SSRPageServerConfig;

/** The module is optional by contract; every test here supplies lookups, so an absent one is the test failing. */
const moduleFrom = (action: Record<string, unknown>) => {
  const module = actionsModuleFor(configWith(action));
  if (!module) {
    throw new Error('lookups were supplied, so a module was expected');
  }

  return module;
};

const answer = { runId: 'run-1', status: 'completed' as const, output: { ok: true } };

const begin = {
  spaceId: 1,
  actionId: 'quote',
  callerId: 'user:1',
  input: {},
  idempotencyKey: 'delivery-1',
  ttlMs: 10_000
};

/**
 * The module is built in ONE place from a deployment's config, and every field it drops is a documented setting
 * that silently does nothing. That is the failure this file exists to catch: the type declares it, the docs promise
 * it, and only a test that goes through this function can tell whether it arrives.
 */
describe('actionsModuleFor', () => {
  it('is inert without lookups: nothing to read means nothing to run', () => {
    expect(actionsModuleFor({} as SSRPageServerConfig)).toBeUndefined();
  });

  it('hands the same module to everyone that asks for one config', () => {
    const config = configWith({});

    expect(actionsModuleFor(config)).toBe(actionsModuleFor(config));
  });

  it('carries the replay window through to the guards', async () => {
    const module = moduleFrom({ idempotency: { replayTtlMs: 60_000 } });
    const run = await module.guards.begin(begin);
    await module.guards.end(run, answer);

    await expect(module.guards.replay(begin)).resolves.toEqual(answer);
  });

  it('leaves replay off when the deployment did not ask for it', async () => {
    const module = moduleFrom({});
    const run = await module.guards.begin(begin);
    await module.guards.end(run, answer);

    await expect(module.guards.replay(begin)).resolves.toBeUndefined();
  });

  it('carries the concurrency ceilings through', async () => {
    const module = moduleFrom({ concurrency: { perSpace: 1 } });
    await module.guards.begin({ ...begin, idempotencyKey: 'a' });

    await expect(module.guards.begin({ ...begin, idempotencyKey: 'b' })).rejects.toThrow(/Too many/);
  });
});
