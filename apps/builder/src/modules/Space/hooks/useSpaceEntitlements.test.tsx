import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useSpaceEntitlements from './useSpaceEntitlements';

vi.mock('@pmodules/Network/hooks/useBuilderNetwork', () => ({
  default: () => ({ server: { apiServer: 'https://api.test' }, userKey: 'k', webId: 'shop' })
}));

const answer = (body: unknown, ok = true) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok, json: () => Promise.resolve(body) } as Response);

afterEach(() => {
  vi.restoreAllMocks();
});

// The builder locks what the plan does not include — and nothing when the server says nothing.
describe('useSpaceEntitlements', () => {
  it('locks what the plan does not include, with the plan that does and the link', async () => {
    answer({
      entitlements: {
        tierLabel: 'Free',
        snapshotsKept: 0,
        analyticsDays: 7,
        capabilities: {
          snapshots: { included: false, label: 'Snapshots', requires: 'Site', upgradeUrl: 'https://p/pricing' },
          customDomain: { included: true, label: 'A custom domain' }
        }
      }
    });
    const { result } = renderHook(() => useSpaceEntitlements());

    await waitFor(() => expect(result.current.locked('snapshots')?.requires).toBe('Site'));
    expect(result.current.included('customDomain')).toBe(true);
    expect(result.current.locked('customDomain')).toBeUndefined();
  });
});
