import { describe, expect, it } from 'vitest';

import { isIncluded, isPlanRefusal } from './entitlements';

describe('the entitlements contract', () => {
  it('includes everything when the server answered none — a self-hosted deployment', () => {
    expect(isIncluded(undefined, 'customDomain')).toBe(true);
    expect(
      isIncluded(
        {
          tierLabel: 'Free',
          snapshotsKept: 0,
          analyticsDays: 7,
          journeysPerSpace: 1,
          serverRunsPerMonth: 10,
          capabilities: {}
        },
        'unknownToThisServer'
      )
    ).toBe(true);
  });

  it('reads what the plan says of a capability it names', () => {
    const free = {
      tierLabel: 'Free',
      snapshotsKept: 0,
      analyticsDays: 7,
      journeysPerSpace: 1,
      serverRunsPerMonth: 10,
      capabilities: { customDomain: { included: false, label: 'A custom domain', requires: 'Site', upgradeUrl: 'u' } }
    };

    expect(isIncluded(free, 'customDomain')).toBe(false);
  });

  it('tells a plan refusal from any other error', () => {
    expect(
      isPlanRefusal({ error: 'x', code: 'plan-required', capability: 'c', requires: 'Site', upgradeUrl: 'https://p' })
    ).toBe(true);
    expect(isPlanRefusal({ error: 'Not found' })).toBe(false);
    expect(isPlanRefusal(null)).toBe(false);
  });
});
