import { describe, expect, it, vi } from 'vitest';

import { accountOwner } from '@plitzi/sdk-shared/state';

import { requestPaintedStateWithDefaults, ssrPaintedCookieName } from './paintedCookie';

const settings = { keepState: true, paintedState: ['workspace', 'consent'], browserState: ['consent'] };
const scope = (account: number | undefined) => ({ spaceId: 7, environment: 'production' as const, account });

/** A request carrying the painted cookie `owner` wrote, or none. */
const request = (entry?: { owner: string; values: Record<string, unknown> }) => {
  const cookie = entry
    ? `${ssrPaintedCookieName('app.example.com')}=${encodeURIComponent(JSON.stringify(entry))}`
    : undefined;

  return { hostname: 'app.example.com', headers: { host: 'app.example.com', ...(cookie ? { cookie } : {}) } };
};

const workspaceOf = (id: string) => ({ workspace: { id, name: `Workspace ${id}`, isAdmin: '1' } });

// A dashboard learned its workspace only once the browser ran: on the first visit after signing in nothing was painted,
// so the server asked nothing for it and the page drew it late.
describe('a painted key the cookie holds none of, from the deployment', () => {
  it('is the deployment’s default for the account the request proved, asked once a request', async () => {
    const defaults = vi.fn(() => workspaceOf('12'));
    const req = request();

    const first = await requestPaintedStateWithDefaults(req, settings, scope(5), defaults);
    const again = await requestPaintedStateWithDefaults(req, settings, scope(5), defaults);

    expect(first.state).toEqual(workspaceOf('12'));
    expect(again).toBe(first);
    expect(defaults).toHaveBeenCalledTimes(1);
    expect(defaults).toHaveBeenCalledWith({ spaceId: 7, environment: 'production', account: 5, keys: ['workspace', 'consent'] });
  });

  it('is never asked for a guest: a guest’s page is every guest’s', async () => {
    const defaults = vi.fn(() => workspaceOf('12'));

    expect((await requestPaintedStateWithDefaults(request(), settings, scope(undefined), defaults)).state).toBeUndefined();
    expect(defaults).not.toHaveBeenCalled();
  });

  it('leaves what the account painted itself, and asks only for what it lacks', async () => {
    const defaults = vi.fn(() => ({ consent: 'all', workspace: { id: '99' } }));
    const req = request({ owner: accountOwner(5), values: workspaceOf('3') });

    const painted = await requestPaintedStateWithDefaults(req, settings, scope(5), defaults);

    expect(painted.state).toEqual({ ...workspaceOf('3'), consent: 'all' });
    expect(defaults).toHaveBeenCalledWith(expect.objectContaining({ keys: ['consent'] }));
  });

  it('draws the next account its own default, never the workspace the previous one painted here', async () => {
    const defaults = vi.fn(({ account }: { account: number | string }) => workspaceOf(`of-${String(account)}`));
    const req = request({ owner: accountOwner(5), values: { ...workspaceOf('3'), consent: 'all' } });

    const painted = await requestPaintedStateWithDefaults(req, settings, scope(8), defaults);

    // The browser's key stays — it is nobody's — and the workspace is the new account's.
    expect(painted.state).toEqual({ consent: 'all', ...workspaceOf('of-8') });
  });

  it('keeps out a key the space does not paint, and draws without when the deployment fails', async () => {
    const extra = await requestPaintedStateWithDefaults(request(), settings, scope(5), () => ({ secret: 'x' }));
    expect(extra.state).toBeUndefined();

    const failing = await requestPaintedStateWithDefaults(request(), settings, scope(5), () => {
      throw new Error('down');
    });
    expect(failing.state).toBeUndefined();
  });
});
