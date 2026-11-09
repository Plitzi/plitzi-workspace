import { describe, expect, it } from 'vitest';

import { LOAD_LIMITS, cpuLimitCores, overloaded, processLoad } from './load';

describe('processLoad', () => {
  it('reads what this process may use, and what it used', () => {
    expect(cpuLimitCores()).toBeGreaterThan(0);
    const load = processLoad();
    expect(load.cpuShare).toBeGreaterThanOrEqual(0);
    expect(load.lagMs).toBeGreaterThanOrEqual(0);
  });

  it('says why a process takes no new work, and nothing while it has room', () => {
    expect(overloaded({ cpuCores: 0.1, cpuShare: 0.1, lagMs: 10 })).toBeUndefined();
    expect(overloaded({ cpuCores: 0.95, cpuShare: LOAD_LIMITS.cpuShare, lagMs: 10 })).toMatch(/^its CPU is 90% used/);
    expect(overloaded({ cpuCores: 0.1, cpuShare: 0.1, lagMs: LOAD_LIMITS.lagMs })).toBe(
      'its event loop is 250 ms behind (p99)'
    );
  });
});
