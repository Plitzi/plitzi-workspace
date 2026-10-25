import { afterEach, describe, expect, it, vi } from 'vitest';

import { localFetch } from '.';

afterEach(() => {
  vi.unstubAllGlobals();
});

// Node 24's fetch failed the first call after a copy's server started — `setTypeOfService EINVAL`, eight times.
describe('a request to a server of this machine', () => {
  it('is asked again once when the socket refused its type of service, and only then', async () => {
    const einval = Object.assign(new Error('setTypeOfService EINVAL'), { syscall: 'setTypeOfService' });
    const answers = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed', { cause: einval }))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', answers);

    expect(await (await localFetch('http://127.0.0.1:8080/health')).text()).toBe('ok');
    expect(answers).toHaveBeenCalledTimes(2);

    const refused = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('fetch failed', { cause: new Error('ECONNREFUSED') }));
    vi.stubGlobal('fetch', refused);
    await expect(localFetch('http://127.0.0.1:8080/health')).rejects.toThrow('fetch failed');
    expect(refused).toHaveBeenCalledTimes(1);
  });
});
