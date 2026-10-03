import { describe, expect, it, vi } from 'vitest';

import { flagsForRun, readsFlags } from './flags';

import type { ActionEntry, Schema, SSRUser } from '@plitzi/sdk-shared';

const entryReading = (template: string): ActionEntry =>
  ({ id: 'checkout', document: { nodes: { a: { type: 'task', params: { text: template } } } } }) as never;

const declared: Schema['flags'] = {
  newCheckout: {
    value: false,
    rules: [
      {
        when: { combinator: 'and', rules: [{ field: 'user.roles', operator: 'contains', value: 'beta' }] },
        value: true
      }
    ]
  },
  legacyNav: { value: true, rules: [] }
};

const beta = { id: 1, username: 'ana', email: 'ana@example.com', roles: ['beta'] } as SSRUser;

describe('readsFlags', () => {
  it('says whether a flow names the flags source anywhere', () => {
    expect(readsFlags(entryReading('{{ flags.newCheckout }}').document)).toBe(true);
    expect(readsFlags(entryReading('{{ input.name }}').document)).toBe(false);
  });
});

describe('flagsForRun', () => {
  it('does not ask for the flags of a flow that reads none', async () => {
    const getFlags = vi.fn();

    expect(
      await flagsForRun(
        { lookups: { getAction: vi.fn(), getFlags } },
        {
          entry: entryReading('{{ input.name }}'),
          spaceId: 1,
          environment: 'production'
        }
      )
    ).toEqual({});
    expect(getFlags).not.toHaveBeenCalled();
  });

  it('resolves them against the run, at its revision, under the server and a tester', async () => {
    const getFlags = vi.fn().mockResolvedValue(declared);
    const at = { environment: 'production' as const, revision: 4 };
    const run = { entry: entryReading('{{ flags.newCheckout }}'), spaceId: 1, environment: 'production' as const, at };

    expect(await flagsForRun({ lookups: { getAction: vi.fn(), getFlags } }, { ...run, user: beta })).toEqual({
      newCheckout: true,
      legacyNav: true
    });
    expect(getFlags).toHaveBeenCalledWith(1, at);

    const layered = await flagsForRun(
      { lookups: { getAction: vi.fn(), getFlags }, flags: () => ({ legacyNav: false, newCheckout: true }) },
      { ...run, forcedFlags: { newCheckout: false } }
    );

    expect(layered).toEqual({ newCheckout: false, legacyNav: false });
  });

  it('sees no flags where the deployment cannot say which there are', async () => {
    expect(
      await flagsForRun(
        { lookups: { getAction: vi.fn() } },
        { entry: entryReading('{{ flags.newCheckout }}'), spaceId: 1, environment: 'production' }
      )
    ).toEqual({});
  });
});
