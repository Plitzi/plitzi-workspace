import { describe, expect, it } from 'vitest';

import { reservePort } from './freePort';
import { unusedPort } from './unusedPort';

// A run's copies start their servers together: each found the same port free, and one of them failed to bind it.
describe('a port reserved by a server starting', () => {
  it('is never handed to another starting at the same time, and is free again once released', async () => {
    const preferred = await unusedPort();
    const [one, two] = await Promise.all([reservePort(preferred), reservePort(preferred)]);
    expect(one.port).not.toBe(two.port);

    one.release();
    const again = await reservePort(preferred);
    expect(again.port).toBe(one.port);
    again.release();
    two.release();
  });
});
