import { describe, expect, it } from 'vitest';

import { tellKind, tellsAbout } from './talk';

import type { RunContext } from '../../../runs/run';

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

/** The refusal `tellKind` throws, read: what an agent is told back. */
const refusal = (text: string, options: Parameters<typeof tellKind>[1]): string => {
  try {
    tellKind(text, options);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  return '';
};

// Six commands said something to the run — tell, ask, block, note, notice, backlog add — and agents reached for the
// wrong one, or for one that never was: one command, one kind at a time.
describe('what task tell says', () => {
  it('is news by default, or the one kind asked', () => {
    expect(tellKind('The about page keeps its id', {})).toBe('news');
    expect(tellKind('Which title?', { ask: true, follow: true })).toBe('ask');
    expect(tellKind('The API key is missing', { blocked: true, needs: 'lead' })).toBe('blocked');
    expect(tellKind('The hero is half done', { handoff: true })).toBe('handoff');
    expect(tellKind('', { standing: true, fraction: 0.5, heldBy: 'a review' })).toBe('standing');
  });

  it('refuses two kinds at once, an option of another kind by its kind, and a kind with nothing said', () => {
    expect(refusal('x', { ask: true, blocked: true })).toContain('one thing at a time: --ask and --blocked');
    expect(refusal('x', { follow: true })).toContain('--follow goes with --ask');
    expect(refusal('x', { blocked: true, heldBy: 'y' })).toContain('--held-by goes with --standing');
    expect(refusal('', { ask: true })).toContain('plitzi task tell "…" --ask');
  });
});
