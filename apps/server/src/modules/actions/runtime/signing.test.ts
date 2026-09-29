import { describe, expect, it } from 'vitest';

import { createSigning } from './signing';

const SECRET = 'a-deployment-secret-of-32-chars!';

describe('createSigning', () => {
  it('verifies what it signed, and nothing changed since', async () => {
    const { sign, verify } = createSigning(SECRET)({ spaceId: 3, environment: 'main' });
    const signature = await sign('owner:board-1');

    expect(await verify('owner:board-1', signature)).toBe(true);
    expect(await verify('owner:board-2', signature)).toBe(false);
    expect(await verify('owner:board-1', `${signature.slice(0, -1)}x`)).toBe(false);
    expect(await verify('owner:board-1', '')).toBe(false);
  });

  it('signs for one space and environment: none vouches for another', async () => {
    const signing = createSigning(SECRET);
    const signature = await signing({ spaceId: 3, environment: 'main' }).sign('key');

    expect(await signing({ spaceId: 4, environment: 'main' }).verify('key', signature)).toBe(false);
    expect(await signing({ spaceId: 3, environment: 'development' }).verify('key', signature)).toBe(false);
  });

  it('is the same on every replica given the same secret', async () => {
    const signature = await createSigning(SECRET)({ spaceId: 3, environment: 'main' }).sign('key');

    expect(await createSigning(SECRET)({ spaceId: 3, environment: 'main' }).verify('key', signature)).toBe(true);
  });

  it('refuses a secret too short to sign with', () => {
    expect(() => createSigning('short')).toThrow('at least 32 characters');
  });
});
