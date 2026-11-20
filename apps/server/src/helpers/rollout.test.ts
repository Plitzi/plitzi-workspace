import { describe, expect, it, vi } from 'vitest';

import { requestRollout } from './rollout';

import type { Schema } from '@plitzi/sdk-shared';

const flags: Schema['flags'] = { newCheckout: { value: false, rules: [], rollout: { percent: 30, value: true } } };

const request = (cookie?: string) => ({ headers: { cookie, host: 'site.example.com' }, protocol: 'https' as const });

describe('requestRollout', () => {
  it('draws a first visitor their place and keeps it', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.12);

    expect(requestRollout(request(), flags, true)).toEqual({
      buckets: { newCheckout: 12 },
      setCookie: 'plitzi_rollout=newCheckout%3A12; Path=/; Max-Age=15552000; SameSite=Lax; Secure'
    });
  });

  it('keeps a returning visitor’s place, and draws nothing', () => {
    expect(requestRollout(request('plitzi_rollout=newCheckout%3A70'), flags, true)).toEqual({
      buckets: { newCheckout: 70 }
    });
  });

  it('draws nothing for a render nobody visits', () => {
    expect(requestRollout(request(), flags, false)).toEqual({ buckets: {} });
  });
});
