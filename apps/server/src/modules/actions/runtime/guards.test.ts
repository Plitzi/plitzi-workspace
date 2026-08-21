import { describe, expect, it } from 'vitest';

import { createRunGuards } from './guards';

import type { BeginRunParams } from './guards';

const params = (overrides: Partial<BeginRunParams> = {}): BeginRunParams => ({
  spaceId: 1,
  actionId: 'quote',
  callerId: 'user:1',
  input: {},
  ttlMs: 10_000,
  ...overrides
});

/** A render carries its own key — two visitors are not one caller submitting twice — so these fixtures do too. */
const render = (n: number, spaceId = 1): BeginRunParams =>
  params({ spaceId, kind: 'render', callerId: 'render', idempotencyKey: `render:${n}` });

describe('createRunGuards', () => {
  it('refuses a second live run under the same key', () => {
    const guards = createRunGuards();
    guards.begin(params());

    expect(() => guards.begin(params())).toThrow(/already running/);
  });

  it('counts calls against their space', () => {
    const guards = createRunGuards({ perSpace: 2 });
    guards.begin(params({ idempotencyKey: 'a' }));
    guards.begin(params({ idempotencyKey: 'b' }));

    expect(() => guards.begin(params({ idempotencyKey: 'c' }))).toThrow(/Too many/);
    // Another space is unaffected: the ceiling is what keeps one space's callers off everyone else's server.
    expect(() => guards.begin(params({ spaceId: 2, idempotencyKey: 'd' }))).not.toThrow();
  });

  /**
   * The rule this file exists for.
   *
   * A render arrives because somebody is READING the page, so the number in flight is the number of visitors —
   * five hundred at once is a page doing well, not a space abusing anything. Counted against the per-space call
   * budget, a popular page refused its own visitors' sections one by one.
   */
  it('does not count renders against the space budget', () => {
    const guards = createRunGuards({ perSpace: 1 });
    guards.begin(params({ idempotencyKey: 'the-one-call' }));

    for (let n = 0; n < 50; n += 1) {
      expect(() => guards.begin(render(n))).not.toThrow();
    }
  });

  it('still holds renders to what the process will carry', () => {
    const guards = createRunGuards({ renderPerProcess: 2 });
    guards.begin(render(1));
    guards.begin(render(2));

    expect(() => guards.begin(render(3))).toThrow(/Too many/);
  });

  /** Two budgets, so a page under load cannot spend the one calls draw on — nor be refused because calls did. */
  it('keeps the two budgets apart', () => {
    const guards = createRunGuards({ perProcess: 1, renderPerProcess: 1 });
    guards.begin(params({ idempotencyKey: 'call' }));

    expect(() => guards.begin(render(1))).not.toThrow();
    expect(() => guards.begin(params({ spaceId: 9, idempotencyKey: 'second-call' }))).toThrow(/Too many/);
  });

  it('frees the slot when the run ends', () => {
    const guards = createRunGuards({ renderPerProcess: 1 });
    const run = guards.begin(render(1));
    guards.end(run);

    expect(() => guards.begin(render(2))).not.toThrow();
  });
});
