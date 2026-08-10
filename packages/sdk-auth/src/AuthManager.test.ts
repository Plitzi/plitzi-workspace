import { describe, expect, it } from 'vitest';

import { AuthManager, registerAuthProvider } from './AuthManager';

import type { AuthEvent } from './AuthProvider';

/**
 * The manager is what the SDK waits on before it renders anything, so its contract is not "sign people in" — it is
 * **always report a state**. A space that names no provider is the common case, not an edge one: every widget, every
 * offline render, every space whose owner never configured auth.
 */
describe('a space that names no provider', () => {
  const states = () => {
    const seen: string[] = [];

    return { seen, listener: (event: AuthEvent) => event.type === 'state' && seen.push(event.state) };
  };

  // The regression this exists for: with no provider the manager settled nothing, so the SDK held its whole tree
  // back waiting for a decision that never came and rendered an empty page. Nothing threw; it simply never painted.
  it('settles to guest instead of never deciding', async () => {
    const { seen, listener } = states();
    const manager = new AuthManager('', listener, {});

    await manager.init();

    expect(seen).toEqual(['guest']);
    expect(manager.getState()).toBe('guest');
  });

  /**
   * "No provider" and "no visitor" are different facts, and only the first one is known here.
   *
   * The reason this matters is that a page arrives here with no provider far more often than a space actually lacks
   * one: `userProvider` comes off the schema, so it is empty for the first render of every page that fetches its
   * schema. Reporting `guest` there contradicted the server, which had already resolved this visitor and rendered
   * the page for them — the page blinked to its signed-out version and back once the schema landed.
   */
  it('does not contradict an identity the server already resolved', async () => {
    const { seen, listener } = states();
    const manager = new AuthManager('', listener, {});

    await manager.init({ user: { id: 1, username: 'ada' }, accessToken: 'from-ssr' });

    expect(seen).toEqual(['authenticated']);
  });

  it('answers every call without a provider behind it', async () => {
    const manager = new AuthManager('', () => undefined, {});

    expect(manager.getProvider()).toBeUndefined();
    expect(manager.can('spaceUpdate')).toBe(false);
    await expect(manager.login({})).resolves.toBeUndefined();
    await expect(manager.refresh()).resolves.toBeUndefined();
    await expect(manager.revalidate()).resolves.toBe(false);
    await expect(manager.logout()).resolves.toBeUndefined();
  });

  it('does the same for a name nobody registered', async () => {
    const { seen, listener } = states();

    await new AuthManager('acme-sso', listener, {}).init();

    expect(seen).toEqual(['guest']);
  });
});

describe('a registered provider', () => {
  it('is selected by name and drives the state from then on', async () => {
    const { seen, listener } = states();
    registerAuthProvider(
      'test-idp',
      () =>
        ({
          name: 'test-idp',
          getState: () => 'authenticated',
          on: (fns: ((event: AuthEvent) => void)[]) => {
            fns.forEach(fn => fn({ type: 'state', state: 'authenticated' }));

            return () => undefined;
          },
          init: () => Promise.resolve(),
          dispose: () => undefined
        }) as never
    );

    const manager = new AuthManager('test-idp', listener, {});
    await manager.init();

    expect(seen).toEqual(['authenticated']);
  });

  const states = () => {
    const seen: string[] = [];

    return { seen, listener: (event: AuthEvent) => event.type === 'state' && seen.push(event.state) };
  };
});
