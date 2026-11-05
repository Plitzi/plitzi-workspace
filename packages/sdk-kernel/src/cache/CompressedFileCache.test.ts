import { describe, expect, it } from 'vitest';

import { CompressedFileCache } from './CompressedFileCache';

const fill = (cache: CompressedFileCache, filePath: string, version: string, bytes: number) => {
  cache.storeFor(filePath, version).br = Buffer.alloc(bytes);
  cache.trim();
};

describe('CompressedFileCache', () => {
  it('hands back the same forms for the same version, and fresh ones once the file changed', () => {
    const cache = new CompressedFileCache(1024);
    fill(cache, '/a.js', 'v1', 10);

    expect(cache.storeFor('/a.js', 'v1').br).toHaveLength(10);
    expect(cache.storeFor('/a.js', 'v2').br).toBeUndefined();
    expect(cache.bytes).toBe(0);
  });

  it('drops the least recently served files first to stay within the budget', () => {
    const cache = new CompressedFileCache(100);
    fill(cache, '/a.js', 'v1', 40);
    fill(cache, '/b.js', 'v1', 40);
    cache.storeFor('/a.js', 'v1');
    fill(cache, '/c.js', 'v1', 40);

    expect(cache.storeFor('/b.js', 'v1').br).toBeUndefined();
    expect(cache.storeFor('/a.js', 'v1').br).toHaveLength(40);
  });

  it('keeps nothing of a file larger than the whole budget', () => {
    const cache = new CompressedFileCache(100);
    fill(cache, '/huge.js', 'v1', 500);

    expect(cache.bytes).toBe(0);
  });
});
