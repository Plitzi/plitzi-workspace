import { describe, expect, it } from 'vitest';

import { basicAuthMiddleware } from './basicAuth';

import type { SSRMiddleware } from '../../types';

type Req = Parameters<SSRMiddleware>[0];
type Res = Parameters<SSRMiddleware>[1];

const SITE = { type: 'basic', user: 'ana', pass: 'open-sesame' };

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

/** One request to a domain behind `site`, answered by the middleware: let through, or asked for the password. */
const ask = async (middleware: SSRMiddleware, site: object, authorization?: string) => {
  const seen = { status: 200, passed: false };
  const headers: Record<string, string> = {};
  // The middleware reads the host, the header and the deployment's credential, and answers with three calls: the rest
  // of a request and a response it never touches.
  const req = {
    hostname: 'acme.example.app',
    headers: authorization ? { authorization } : {},
    ctx: { spaceDeployment: { credential: { provider: 'ssr', data: site } } }
  } as unknown as Req;
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    setStatus: (code: number) => {
      seen.status = code;
    },
    end: () => undefined
  } as unknown as Res;
  await middleware(req, res, () => {
    seen.passed = true;

    return Promise.resolve();
  });

  return { status: seen.passed ? 200 : seen.status, challenge: headers['www-authenticate'] };
};

describe('basicAuthMiddleware', () => {
  it('asks for the password, and lets the right pair alone through', async () => {
    const middleware = basicAuthMiddleware();

    const asked = await ask(middleware, SITE);

    expect(asked.status).toBe(401);
    expect(asked.challenge).toMatch(/^Basic realm=/u);
    expect((await ask(middleware, SITE, basic('ana', 'wrong'))).status).toBe(401);
    expect((await ask(middleware, SITE, basic('ana', 'open-sesame'))).status).toBe(200);
  });

  /** A pair once accepted is believed for a while — but never past a change of the password it matched. */
  it('asks again at once when the password changes', async () => {
    const middleware = basicAuthMiddleware();
    const old = basic('ana', 'open-sesame');

    expect((await ask(middleware, SITE, old)).status).toBe(200);
    expect((await ask(middleware, { ...SITE, pass: 'new-one' }, old)).status).toBe(401);
  });
});
