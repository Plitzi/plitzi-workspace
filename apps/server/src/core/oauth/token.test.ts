import { createHash } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { handleAuthorizeStart, handleAuthorizeSubmit } from './authorize';
import { handleToken } from './token';

import type { OAuthParams } from './params';
import type { OAuthConfig, SSRRequest, SSRResponseHelpers } from '@plitzi/sdk-shared';

/**
 * A client that asked to CHOOSE — which space to work in — gets the choice back with its credential.
 *
 * The grant screen is where the person picks; the token response is the only thing the client reads afterwards. Without
 * the choice on it, a native client granted "this space" would hold a working credential and not know what for.
 */

const CLIENT = { clientId: 'cli', redirectUris: ['http://127.0.0.1:4567/callback'] };
const VERIFIER = 'a-verifier-long-enough-to-be-a-real-one-0123456789';
const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64url');

const capture = () => {
  const sent = { body: '' as unknown, status: 0, headers: {} as Record<string, string> };
  const res = {
    setStatus: vi.fn((value: number) => {
      sent.status = value;
    }),
    setHeader: vi.fn((name: string, value: string) => {
      sent.headers[name] = value;
    }),
    send: vi.fn((value: unknown) => {
      sent.body = value;
    }),
    json: vi.fn((value: unknown) => {
      sent.body = value;
    }),
    redirect: vi.fn((value: string) => {
      sent.headers.Location = value;
    }),
    end: vi.fn()
  } as unknown as SSRResponseHelpers;

  return { res, sent };
};

const setup = () => {
  const rows = new Map<string, string>([[`oauth:client:${CLIENT.clientId}`, JSON.stringify(CLIENT)]]);
  const grantTargets = vi.fn((_user: unknown, { scope }: { scope?: string }) =>
    Promise.resolve(
      scope === 'space'
        ? [
            { value: 'space:1', label: 'Website' },
            { value: 'space:2', label: 'Blog' }
          ]
        : [{ value: 'account', label: 'Your account' }]
    )
  );
  const config = {
    issuer: 'https://api.plitzi.test',
    signInUrl: 'https://auth.plitzi.test/login',
    directTokens: true,
    adapters: {
      identify: () => Promise.resolve({ id: '7', label: 'ada@plitzi.test' }),
      grantTargets,
      issueToken: () => Promise.resolve({ token: 'session-token', expiresInSeconds: 3600 }),
      store: {
        put: (key: string, value: string) => void rows.set(key, value),
        get: (key: string) => rows.get(key),
        drop: (key: string) => void rows.delete(key)
      }
    }
  } as unknown as OAuthConfig;

  return { config, grantTargets };
};

const request = { headers: { host: 'api.plitzi.test' } } as unknown as SSRRequest;

const authorizeParams = (scope?: string): OAuthParams => ({
  response_type: 'code',
  client_id: CLIENT.clientId,
  redirect_uri: CLIENT.redirectUris[0],
  code_challenge: CHALLENGE,
  code_challenge_method: 'S256',
  state: 'st-1',
  ...(scope ? { scope } : {})
});

/** A token endpoint answer, which is sent as JSON text. */
const answer = (body: unknown): Record<string, unknown> =>
  (typeof body === 'string' ? JSON.parse(body) : body) as Record<string, unknown>;

/** The grant screen's hidden fields, as the browser posts them back with the choice. */
const hiddenFields = (html: string): OAuthParams =>
  Object.fromEntries(
    [...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"/gu)].map(([, name, value]) => [name, value])
  );

/** The flow as a browser and a client walk it: the screen, the choice, the code, the token. */
const grant = async (config: OAuthConfig, scope: string | undefined, target: string) => {
  const screen = capture();
  await handleAuthorizeStart(config, screen.res, authorizeParams(scope), request);

  const submitted = capture();
  await handleAuthorizeSubmit(config, submitted.res, { ...hiddenFields(String(screen.sent.body)), target }, request);
  const code = new URL(submitted.sent.headers.Location).searchParams.get('code') ?? '';

  const token = capture();
  await handleToken(config, token.res, {
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT.clientId,
    redirect_uri: CLIENT.redirectUris[0],
    code_verifier: VERIFIER
  });

  return answer(token.sent.body);
};

describe('the token response / what was chosen', () => {
  it('hands the grant screen the scope the client asked for, so it can offer what that scope chooses among', async () => {
    const { config, grantTargets } = setup();

    await grant(config, 'space', 'space:2');

    expect(grantTargets).toHaveBeenCalledWith(expect.anything(), { scope: 'space' });
  });

  it('says which target the person chose, beside the credential', async () => {
    const { config } = setup();

    const body = await grant(config, 'space', 'space:2');

    expect(body).toMatchObject({ access_token: 'session-token', token_type: 'Bearer', target: 'space:2' });
  });

  it('says it again on every renewal, since the choice is the grant’s and not the first token’s', async () => {
    const { config } = setup();
    const first = await grant(config, 'space', 'space:1');

    const renewed = capture();
    await handleToken(config, renewed.res, {
      grant_type: 'refresh_token',
      refresh_token: String(first.refresh_token),
      client_id: CLIENT.clientId
    });

    expect(answer(renewed.sent.body)).toMatchObject({ target: 'space:1' });
  });

  it('offers what a client that asked for nothing in particular is granted', async () => {
    const { config, grantTargets } = setup();

    const body = await grant(config, undefined, 'account');

    expect(grantTargets).toHaveBeenCalledWith(expect.anything(), { scope: undefined });
    expect(body).toMatchObject({ target: 'account' });
  });
});
