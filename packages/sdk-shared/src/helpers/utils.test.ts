import { describe, expect, it } from 'vitest';

import { getKeyDecoded } from './utils';

/** A token as the platform signs one: a header, the claims, and a signature nothing here checks. */
const tokenWith = (claims: Record<string, unknown>): string =>
  `e30.${Buffer.from(JSON.stringify(claims)).toString('base64')}.signature`;

describe('the space a web key names', () => {
  it('is the token’s subject', () => {
    expect(getKeyDecoded(tokenWith({ sub: '12', typ: 'space' }), true)).toBe(12);
  });

  it('is none for no key, a key that is not a token, or a subject that is not a space id', () => {
    expect(getKeyDecoded('', true)).toBe(0);
    expect(getKeyDecoded('not-a-token', true)).toBe(0);
    expect(getKeyDecoded(tokenWith({ sub: 'acme' }), true)).toBe(0);
    expect(getKeyDecoded(tokenWith({}), true)).toBe(0);
  });

  it('is the claims themselves when asked for them', () => {
    expect(getKeyDecoded(tokenWith({ sub: '12' }))).toEqual({ sub: '12' });
  });
});
