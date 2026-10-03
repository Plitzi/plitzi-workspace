import { describe, expect, it } from 'vitest';

import {
  flagsCookieName,
  forcedFlagsFromCookies,
  parseFlagList,
  serializeFlagList,
  withForcedFlag
} from './flagsCookie';

describe('the flags cookie', () => {
  it('is named for the port, like the debug preference', () => {
    expect(flagsCookieName('localhost:4013')).toBe('plitzi_flags_4013');
    expect(flagsCookieName('example.com')).toBe('plitzi_flags');
  });

  it('round-trips what a tester forced', () => {
    const forced = { newCheckout: true, legacyNav: false };

    expect(parseFlagList(serializeFlagList(forced))).toEqual(forced);
  });

  it('keeps nothing that is not a flag name and a 0 or a 1', () => {
    expect(parseFlagList('ok:1,bad name:1,also:yes,__proto__:1,x')).toEqual({ ok: true });
  });

  it('reads from a Cookie header', () => {
    expect(forcedFlagsFromCookies('a=b; plitzi_flags_5000=beta%3A1', 'localhost:5000')).toEqual({ beta: true });
    expect(forcedFlagsFromCookies(undefined, 'localhost:5000')).toEqual({});
  });

  it('forces one flag, changes it, and stops forcing it, leaving the others as they were', () => {
    const forced = withForcedFlag({ legacyNav: false }, 'newCheckout', true);
    expect(forced).toEqual({ legacyNav: false, newCheckout: true });
    expect(withForcedFlag(forced, 'newCheckout', false)).toEqual({ legacyNav: false, newCheckout: false });
    expect(withForcedFlag(forced, 'newCheckout', undefined)).toEqual({ legacyNav: false });
  });
});
