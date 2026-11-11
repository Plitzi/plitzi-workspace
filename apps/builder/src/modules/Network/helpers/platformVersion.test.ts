import { afterEach, describe, expect, it, vi } from 'vitest';

import { CLIENT_HEADER, CURRENT_HEADER } from '@plitzi/sdk-shared/clients';

import { hearPlatform, onPlatformVersion, platformFetch, versionedFetch } from './platformVersion';

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

describe('the builder’s calls to the API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('say which builder they are, keep their own headers, and stop it when the platform refuses it', async () => {
    const sent = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 'outdated', error: 'This builder is 0.1.0' }), { status: 426 })
      );
    const heard: PlatformHeard[] = [];
    const stop = onPlatformVersion(each => heard.push(each));
    const response = await platformFetch('https://api.test/spaces/1/usage', {
      headers: { 'plitzi-access-token': 'k' }
    });
    stop();
    const headers = new Headers(sent.mock.calls[0]?.[1]?.headers);

    expect(headers.get(CLIENT_HEADER)).toMatch(/^builder\/\d+\.\d+\.\d+/);
    expect(headers.get('plitzi-access-token')).toBe('k');
    expect(heard).toEqual([{ kind: 'outdated', message: 'This builder is 0.1.0' }]);
    // The caller still reads the answer whole.
    expect(await response.json()).toMatchObject({ code: 'outdated' });
  });
});
