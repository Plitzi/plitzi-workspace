import { describe, expect, it } from 'vitest';

import { DEFAULT_CACHE_BYTES } from './defaults';
import { bytesFromEnvironment, CACHE_ENV, cacheLimitsOf } from './limits';

describe('the cache limits', () => {
  it('reads a size in bytes, or with a unit', () => {
    expect(bytesFromEnvironment('SIZE', { SIZE: '134217728' })).toBe(128 * 1024 ** 2);
    expect(bytesFromEnvironment('SIZE', { SIZE: '512MB' })).toBe(512 * 1024 ** 2);
    expect(bytesFromEnvironment('SIZE', { SIZE: '2gb' })).toBe(2 * 1024 ** 3);
    expect(bytesFromEnvironment('SIZE', { SIZE: ' 1.5 GB ' })).toBe(1.5 * 1024 ** 3);
  });

  it('says nothing when the environment says nothing', () => {
    expect(bytesFromEnvironment('SIZE', {})).toBeUndefined();
    expect(bytesFromEnvironment('SIZE', { SIZE: '' })).toBeUndefined();
  });

  // A typo read as no limit would be a cache with none.
  it('refuses what is not a size, naming the variable', () => {
    expect(() => bytesFromEnvironment('SIZE', { SIZE: '128 megs' })).toThrow(/SIZE must be a size/);
    expect(() => bytesFromEnvironment('SIZE', { SIZE: '0' })).toThrow(/SIZE must be a size/);
  });

  it('takes the config, else the environment, else the default', () => {
    const env = { [CACHE_ENV.maxBytes]: '1GB' };

    expect(cacheLimitsOf({ cache: { maxBytes: 10 } }, env).maxBytes).toBe(10);
    expect(cacheLimitsOf({}, env).maxBytes).toBe(1024 ** 3);
    expect(cacheLimitsOf({}, {}).maxBytes).toBe(DEFAULT_CACHE_BYTES.html);
  });
});
