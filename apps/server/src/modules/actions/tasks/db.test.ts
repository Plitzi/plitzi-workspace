import { describe, expect, it } from 'vitest';

import { createActionsModule } from '../index';

import type { ActionDbDriver } from '../types';
import type { ActionEntry, ElementInteraction } from '@plitzi/sdk-shared';

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

const entry = (params: Record<string, unknown>): ActionEntry => ({
  id: 'lookup',
  document: {
    name: 'Lookup',
    enabled: true,
    nodes: {
      start: node('start', {
        type: 'trigger',
        action: 'call',
        params: { access: 'public', input: '{"email":{"type":"text"}}' },
        afterNode: 'q'
      }),
      q: node('q', { action: 'db.query', afterNode: 'out', params }),
      out: node('out', { action: 'flow.output', params: { values: '{"count": {{ q.count }}}' } })
    }
  }
});

const driver = (): ActionDbDriver & { calls: unknown[][] } => {
  const calls: unknown[][] = [];

  return {
    engine: 'mysql',
    calls,
    query: (dsn, sql, params) => {
      calls.push([dsn, sql, params]);

      return Promise.resolve([{ id: 1 }]);
    }
  };
};

/** `null` is the space not having the credential at all, which `undefined` cannot say — that is the default. */
const run = (
  params: Record<string, unknown>,
  drivers: ActionDbDriver[],
  credential?: Record<string, string> | null
) => {
  const lookups = {
    getAction: () => Promise.resolve(undefined),
    getCredential: () =>
      Promise.resolve(
        credential === null ? undefined : (credential ?? { engine: 'mysql', dsn: 'mysql://user@customer/db' })
      )
  };
  const { runAction } = createActionsModule({ lookups, dbDrivers: drivers });

  return runAction({
    entry: entry(params),
    input: { email: 'ana@example.com' },
    spaceId: 1,
    environment: 'main',
    trigger: 'call',
    runId: 'run-1'
  });
};

describe('db.query', () => {
  it('binds parameters instead of pasting them into the statement', async () => {
    const engine = driver();

    const result = await run(
      {
        credential: 'crm-db',
        sql: 'SELECT id FROM customers WHERE email = ?',
        params: '["{{ input.email }}"]'
      },
      [engine]
    );

    const [dsn, sql, params] = engine.calls[0] as [string, string, unknown[]];
    expect(dsn).toBe('mysql://user@customer/db');
    expect(sql).toBe('SELECT id FROM customers WHERE email = ?');
    expect(params).toEqual(['ana@example.com']);
    expect(result.output).toEqual({ count: 1 });
  });

  // The rule the whole task stands on: interpolating a value into a statement is SQL injection with a visual
  // editor on top, so a templated statement is refused rather than escaped.
  it('refuses a statement carrying a template', async () => {
    const engine = driver();

    const result = await run(
      { credential: 'crm-db', sql: 'SELECT id FROM customers WHERE email = "{{ input.email }}"', params: '[]' },
      [engine]
    );

    expect(result.status).toBe('failed');
    expect(engine.calls).toEqual([]);
  });

  /** A step names the connection it wants and the space either has it or does not. What must not happen is the
   *  query running against something nobody named. */
  it('fails the step when the space has no such connection credential', async () => {
    const engine = driver();

    const result = await run({ credential: 'other-db', sql: 'SELECT 1', params: '[]' }, [engine], null);

    expect(result.status).toBe('failed');
    expect(engine.calls).toEqual([]);
  });

  it('says so when this server has no driver for the credential’s engine', async () => {
    // A mysql driver is registered — so the STEP exists — but the credential names postgres.
    const result = await run({ credential: 'crm-db', sql: 'SELECT 1', params: '[]' }, [driver()], {
      engine: 'postgres',
      dsn: 'postgres://x'
    });

    expect(result.status).toBe('failed');
  });

  // A catalog is a promise about what this server can do, so the step is not offered at all without an engine.
  it('is not in the catalog when no driver is registered', () => {
    const bare = createActionsModule({ lookups: { getAction: () => Promise.resolve(undefined) } });
    const withDriver = createActionsModule({
      lookups: { getAction: () => Promise.resolve(undefined) },
      dbDrivers: [driver()]
    });

    expect(bare.registry.get('db.query')).toBeUndefined();
    expect(withDriver.registry.get('db.query')).toBeDefined();
  });
});
