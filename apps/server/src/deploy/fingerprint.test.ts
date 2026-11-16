import { describe, expect, it } from 'vitest';

import { digestOf, fingerprintChanges, fingerprintOf } from './fingerprint';

describe('a build’s fingerprint', () => {
  it('is the same for the same parts, whatever their order', () => {
    expect(digestOf({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(digestOf({ b: [1, { d: 3, c: 2 }], a: 1 }));
    expect(fingerprintOf({ sdk: 'x', fonts: 'y' }).digest).toBe(fingerprintOf({ fonts: 'y', sdk: 'x' }).digest);
  });

  it('names the parts a deploy would change, new and gone ones too', () => {
    expect(
      fingerprintChanges(
        { sdk: 'old', fonts: 'same', key: 'k' },
        { sdk: 'new', fonts: 'same', environment: 'production' }
      )
    ).toEqual(['sdk', 'environment', 'key']);
  });
});
