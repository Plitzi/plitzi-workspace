import { describe, expect, it } from 'vitest';

import { CURRENT_HEADER } from '@plitzi/sdk-shared/clients';

import { hearPlatform, onPlatformVersion, versionedFetch } from './platformVersion';

import type { PlatformHeard } from './platformVersion';

describe('the platform’s version, heard by the builder', () => {
  it('hears a builder behind on any answer, and says it once for each version of the platform', async () => {
    const heard: PlatformHeard[] = [];
    const stop = onPlatformVersion(each => heard.push(each));
    const answer = (current?: string) => () =>
      Promise.resolve(new Response('{}', { headers: current ? { [CURRENT_HEADER]: current } : {} }));

    await versionedFetch(answer())('https://server.plitzi.test/graphql');
    await versionedFetch(answer('9.1.0'))('https://server.plitzi.test/graphql');
    await versionedFetch(answer('9.1.0'))('https://server.plitzi.test/graphql');
    await versionedFetch(answer('9.2.0'))('https://server.plitzi.test/graphql');
    stop();

    expect(heard).toEqual([
      { kind: 'behind', current: '9.1.0' },
      { kind: 'behind', current: '9.2.0' }
    ]);
  });

  it('says every refusal of a builder too old: nothing it asks is answered after', () => {
    const heard: PlatformHeard[] = [];
    const stop = onPlatformVersion(each => heard.push(each));
    hearPlatform({ kind: 'outdated', message: 'This builder is 0.1.0' });
    hearPlatform({ kind: 'outdated', message: 'This builder is 0.1.0' });
    stop();

    expect(heard).toHaveLength(2);
  });
});
