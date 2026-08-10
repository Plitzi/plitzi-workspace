/* eslint-disable quotes */
import { describe, expect, it, vi } from 'vitest';

import { spaceDeploymentMiddleware } from './spaceDeployment';

import type { SSRAdapters, SSRRequest, SSRResponseHelpers, SSRSpaceDeployment } from '@plitzi/sdk-shared';

/**
 * Framing is a per-space question — one static list cannot know which sites a given space's owner allowed — so it
 * is answered here, where the deployment has just been resolved. A published space that any site could wrap in an
 * iframe is how one customer's content ends up presented as somebody else's.
 */

const run = async (deployment: SSRSpaceDeployment) => {
  const headers: Record<string, string> = { 'Content-Security-Policy': "frame-ancestors 'none'" };
  const res = {
    status: 200,
    headers,
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    setStatus: vi.fn(),
    send: vi.fn(),
    write: vi.fn(),
    end: vi.fn()
  } as unknown as SSRResponseHelpers;

  const req = { ctx: {} } as unknown as SSRRequest;
  const adapters = { getSpaceDeployment: () => Promise.resolve(deployment) } as unknown as SSRAdapters;
  const next = vi.fn(() => Promise.resolve());

  await spaceDeploymentMiddleware(adapters)(req, res, next);

  return { headers, next, res };
};

describe('spaceDeploymentMiddleware — framing', () => {
  it('lets the space widen the policy to the domains its owner declared', async () => {
    const { headers, next } = await run({
      spaceId: 42,
      frameAncestors: ["'self'", 'https://ssr-dev.plitzi.com', 'https://acme.com']
    });

    expect(headers['Content-Security-Policy']).toBe(
      "frame-ancestors 'self' https://ssr-dev.plitzi.com https://acme.com"
    );
    expect(next).toHaveBeenCalled();
  });

  // The server-wide header is set before any stage runs and cannot know the space; this one does, so it wins.
  it('overrides the server-wide default rather than appending to it', async () => {
    const { headers } = await run({ spaceId: 42, frameAncestors: ["'self'"] });

    expect(headers['Content-Security-Policy']).toBe("frame-ancestors 'self'");
  });

  // A space whose owner opted into the wildcard is framable anywhere, deliberately — the domains API says so
  // in its response rather than letting it happen quietly.
  it('honours the wildcard a space opted into', async () => {
    const { headers } = await run({ spaceId: 42, frameAncestors: ['*'] });

    expect(headers['Content-Security-Policy']).toBe('frame-ancestors *');
  });

  it('leaves the default alone when the consumer resolves no policy', async () => {
    const { headers } = await run({ spaceId: 42 });

    expect(headers['Content-Security-Policy']).toBe("frame-ancestors 'none'");
  });

  it('answers the request and sets nothing when the space does not resolve', async () => {
    const { next, res } = await run({ error: { code: 404, message: 'Space not found' } });

    expect(next).not.toHaveBeenCalled();
    expect(res.setStatus).toHaveBeenCalledWith(404);
  });
});
