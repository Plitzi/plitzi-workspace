import { createHash } from 'node:crypto';
import { createServer } from 'node:http';

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A platform for the tests to sign in to: the native OAuth endpoints, the account's session, a space and its CDNs —
 * on a real loopback port, so the CLI's requests travel as they do against the real one.
 *
 * `browser` stands in for the person at the grant screen: handed the `/authorize` address, it answers the loopback
 * callback with a code, having chosen `choose` when the client asked to choose a space.
 */

export interface FakeUpload {
  path: string;
  contentType: string;
  bytes: number;
}

export interface FakePlatform {
  api: string;
  /** Opens the grant screen and answers it, as the person would. */
  browser: (url: string) => void;
  /** What the person picks on the grant screen when asked to choose a space. */
  choose: string;
  /** Every scope an `/authorize` was asked with (`''` for none). */
  scopes: string[];
  /** Refresh tokens revoked. */
  revoked: string[];
  /** What each client registered as. */
  registrations: Record<string, unknown>[];
  uploads: FakeUpload[];
  cdns: { identifier: string; name: string; domain: string; provider: string }[];
  /** Access tokens the platform accepts; emptied to have it answer 401. */
  valid: Set<string>;
  /** Answers 401 to every access token, the ones it has just renewed included. */
  refuseAll: boolean;
  /** Refresh tokens it renews. */
  renewable: Set<string>;
  /** Seconds each access token lives. */
  expiresIn: number;
  close: () => Promise<void>;
}

const readBody = async (req: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }

  return Buffer.concat(chunks);
};

const json = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
};

export const fakePlatform = async (): Promise<FakePlatform> => {
  let issued = 0;
  const pending = new Map<string, { challenge: string; target: string }>();
  const grants = new Map<string, string>();

  const mint = (target: string) => {
    issued += 1;
    const access = `access-${issued}`;
    const refresh = `refresh-${issued}`;
    platform.valid.add(access);
    platform.renewable.add(refresh);
    grants.set(refresh, target);

    return {
      access_token: access,
      refresh_token: refresh,
      expires_in: platform.expiresIn,
      token_type: 'Bearer',
      target
    };
  };

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', platform.api);
      const body = await readBody(req);
      const form = new URLSearchParams(body.toString());
      const signedIn =
        !platform.refuseAll && platform.valid.has((req.headers.authorization ?? '').replace('Bearer ', ''));

      if (url.pathname === '/.well-known/oauth-authorization-server') {
        json(res, 200, {
          issuer: platform.api,
          authorization_endpoint: `${platform.api}/authorize`,
          token_endpoint: `${platform.api}/token`,
          registration_endpoint: `${platform.api}/register`,
          revocation_endpoint: `${platform.api}/revoke`
        });
      } else if (url.pathname === '/register') {
        platform.registrations.push(JSON.parse(body.toString()) as Record<string, unknown>);
        json(res, 201, { client_id: `client-${issued + 1}` });
      } else if (url.pathname === '/token' && form.get('grant_type') === 'authorization_code') {
        const code = pending.get(form.get('code') ?? '');
        const verifier = createHash('sha256')
          .update(form.get('code_verifier') ?? '')
          .digest('base64url');
        if (code?.challenge !== verifier) {
          json(res, 400, { error: 'invalid_grant' });

          return;
        }

        json(res, 200, mint(code.target));
      } else if (url.pathname === '/token' && form.get('grant_type') === 'refresh_token') {
        const refresh = form.get('refresh_token') ?? '';
        if (!platform.renewable.has(refresh)) {
          json(res, 400, { error: 'invalid_grant', error_description: 'The refresh token is unknown or has expired.' });

          return;
        }

        platform.renewable.delete(refresh);
        json(res, 200, mint(grants.get(refresh) ?? 'account'));
      } else if (url.pathname === '/revoke') {
        platform.revoked.push(form.get('token') ?? '');
        json(res, 200, {});
      } else if (!signedIn) {
        json(res, 401, { error: 'Not authenticated' });
      } else if (url.pathname === '/auth/session') {
        json(res, 200, { success: true, details: { email: 'ada@example.com', username: 'ada' } });
      } else if (url.pathname === '/spaces/3') {
        json(res, 200, { space: { id: 3, name: 'Website', permanentUrl: 'website' } });
      } else if (url.pathname === '/spaces/3/cdns') {
        json(res, 200, { cdns: platform.cdns });
      } else if (url.pathname.startsWith('/spaces/3/cdns/') && req.method === 'POST') {
        platform.uploads.push({
          path: `${url.pathname}${url.search}`,
          contentType: req.headers['content-type'] ?? '',
          bytes: body.byteLength
        });
        json(res, 201, {
          resource: { path: 'https://cdn.example.com/website/plugins/ab12_seat-picker/ab12_seat-picker.zip' },
          plugin: { root: 'seatPicker', version: '1.2.0' },
          installed: 'added'
        });
      } else {
        json(res, 404, { error: 'Not found' });
      }
    })();
  });

  await new Promise<void>(done => {
    server.listen(0, '127.0.0.1', () => done());
  });

  const platform: FakePlatform = {
    // A listening server always has an address object; only a pipe's is a string.
    api: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    choose: 'space:3',
    scopes: [],
    revoked: [],
    registrations: [],
    uploads: [],
    cdns: [{ identifier: 'cdn-main', name: 'Main', domain: 'https://cdn.example.com', provider: 'aws' }],
    valid: new Set(),
    refuseAll: false,
    renewable: new Set(),
    expiresIn: 3600,
    browser: url => {
      const asked = new URL(url).searchParams;
      const scope = asked.get('scope') ?? '';
      platform.scopes.push(scope);
      const code = `code-${platform.scopes.length}`;
      pending.set(code, {
        challenge: asked.get('code_challenge') ?? '',
        target: scope.split(' ').includes('space') ? platform.choose : 'account'
      });
      const callback = new URL(asked.get('redirect_uri') ?? '');
      callback.search = new URLSearchParams({ code, state: asked.get('state') ?? '' }).toString();
      void fetch(callback);
    },
    close: () =>
      new Promise<void>(done => {
        server.closeAllConnections();
        server.close(() => done());
      })
  };

  return platform;
};
