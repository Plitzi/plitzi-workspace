import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ownVersion } from './ownVersion';

describe('ownVersion', () => {
  it('is the version of @plitzi/sdk-server, read from its own manifest', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };

    expect(ownVersion()).toBe(manifest.version);
  });
});
