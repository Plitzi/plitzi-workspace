import { describe, it, expect, vi, afterEach } from 'vitest';

import { getReporter, setReporter, track } from './reporterRegistry';

import type { Reporter } from './createReporter';

afterEach(() => {
  setReporter(undefined);
});

describe('Analytics/reporterRegistry', () => {
  // The offline scenarios: an exported widget, an MCP render, a host embedding the SDK with its own data.
  // There is no server to report to, so `track` has to be silent rather than something a page must guard.
  it('is a no-op when this render reports nothing', () => {
    expect(() => track('signup', { plan: 'pro' })).not.toThrow();
    expect(getReporter()).toBeUndefined();
  });

  it('forwards to the live reporter once one is mounted', () => {
    const reporter = { track: vi.fn() } as unknown as Reporter;
    setReporter(reporter);

    track('signup', { plan: 'pro' });

    expect(reporter.track).toHaveBeenCalledWith('signup', { plan: 'pro' });
  });

  it('goes quiet again when the render that owned it goes away', () => {
    const reporter = { track: vi.fn() } as unknown as Reporter;
    setReporter(reporter);
    setReporter(undefined);

    track('signup');

    expect(reporter.track).not.toHaveBeenCalled();
  });
});
