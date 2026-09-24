import { describe, expect, it, vi } from 'vitest';

import type { SSRContext } from '../types';

const built = vi.hoisted(() => ({ deployment: 0, basicAuth: 0, auth: 0 }));
const pass = () => async (_req: unknown, _res: unknown, next: () => Promise<void>) => next();

vi.mock('../../../middlewares/spaceDeployment', () => ({
  spaceDeploymentMiddleware: () => (built.deployment++, pass())
}));
vi.mock('../../../middlewares/basicAuth', () => ({ basicAuthMiddleware: () => (built.basicAuth++, pass()) }));
vi.mock('../../../middlewares/auth', () => ({ authMiddleware: () => (built.auth++, pass()) }));

const { createMiddlewaresStage } = await import('./middlewares');

const context = (config: object) => ({ config, req: {}, res: { status: 200 } }) as unknown as SSRContext;

/**
 * Middlewares hold state across requests. Built per request, `basicAuthMiddleware` left a cache and its sweep timer
 * behind on every one — about a kilobyte a request, kept for good, until the process ran out of memory.
 */
describe('core/http/stages/middlewares', () => {
  it('builds the chain once per server, however many requests it serves', async () => {
    const stage = createMiddlewaresStage();
    const config = { adapters: {} };

    for (let request = 0; request < 50; request += 1) {
      await stage(context(config));
    }

    expect(built).toEqual({ deployment: 1, basicAuth: 1, auth: 1 });
  });

  it('lets the request through when no middleware answered', async () => {
    expect(await createMiddlewaresStage()(context({ adapters: {} }))).toBe(false);
  });
});
