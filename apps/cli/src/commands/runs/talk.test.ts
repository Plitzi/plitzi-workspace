import { describe, expect, it } from 'vitest';

import { tellsAbout } from './talk';

import type { RunContext } from '../../runs/run';

const ctx = (token?: string): Pick<RunContext, 'token'> => (token ? { token } : {});
const TOKEN = `run-10.t-menu.${'a'.repeat(48)}`;

describe('task tell --about', () => {
  // A run's dev-1, holding t-visual-listen-parallel, was refused telling the lead of s-suite-failures.
  it('speaks of another task by name, whether the caller holds one or not', () => {
    expect(tellsAbout(ctx(TOKEN), 's-suite-failures')).toBe(true);
    expect(tellsAbout(ctx(), 's-suite-failures')).toBe(true);
    expect(tellsAbout(ctx(TOKEN), 't-menu')).toBe(false);
    expect(tellsAbout(ctx(TOKEN), undefined)).toBe(false);
  });
});
