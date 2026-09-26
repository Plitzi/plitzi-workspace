import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import os from 'node:os';

import { postForm, requestJson } from './http';

import type { AddressInfo } from 'node:net';

/**
 * Signing in the way a native application is supposed to: in the person's browser, never at this prompt.
 *
 * The CLI opens the platform's `/authorize`, waits on a loopback address for the answer, and exchanges a one-shot code
 * for the person's session. It never sees a password — so it cannot store one or leak one; MFA and social sign-in work
 * without it knowing they exist; and a session revoked from the account's device list is revoked here.
 *
 * The same flow the desktop app runs (`apps/desktop/electron/signIn.ts`), against the same authorization server: the
 * platform's auth is the one place credentials are granted. Choosing a space is part of it too — asked with the `space`
 * scope, the choice is made on the grant screen and comes back beside the session as the grant's `target`.
 */

const base64url = (buffer: Buffer): string => buffer.toString('base64url');

/**
 * What the account's device list calls this sign-in: the CLI, and the machine it runs on — two laptops signed in are
 * two rows somebody has to tell apart. macOS names a machine `Carlos-MacBook-Pro.local`; the suffix says nothing.
 */
export const clientName = (): string => {
  const host = os.hostname().replace(/\.local$/iu, '');

  return host ? `Plitzi CLI on ${host}` : 'Plitzi CLI';
};

/** How long the terminal waits for somebody to finish in the browser before giving the port back. */
const FLOW_TIMEOUT_MS = 5 * 60 * 1000;

/** What a sign-in gives: the session, how to renew it, and what the person granted it for. */
export interface Grant {
  /** A native client registers per flow — the redirect names a port the OS picked — so renewing needs this one. */
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  /** Seconds since the epoch. */
  expiresAt?: number;
  /** `account`, or `space:<id>` when the person chose a space. */
  target?: string;
}

export type GrantResult =
  | { ok: true; grant: Grant }
  /** `unreachable`: nobody answered — never a reason to forget a session. `refused`: the server said no. */
  | { ok: false; reason: 'timeout' | 'refused' | 'unreachable'; error?: string };

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  target?: string;
  error?: string;
  error_description?: string;
};

/** Where the server's endpoints are, as its RFC 8414 discovery document publishes them. */
interface Endpoints {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  revocation_endpoint?: string;
}

const discover = async (apiUrl: string): Promise<{ ok: true; endpoints: Endpoints } | { ok: false; error: string }> => {
  const reply = await requestJson<Partial<Endpoints>>(`${apiUrl}/.well-known/oauth-authorization-server`);
  if (!reply.ok) {
    return reply;
  }

  const { authorization_endpoint, token_endpoint, registration_endpoint, revocation_endpoint } = reply.data;
  if (reply.status !== 200 || !authorization_endpoint || !token_endpoint || !registration_endpoint) {
    return { ok: false, error: `${apiUrl} does not offer signing in from the command line.` };
  }

  return {
    ok: true,
    endpoints: { authorization_endpoint, token_endpoint, registration_endpoint, revocation_endpoint }
  };
};

const page = (title: string, message: string): string =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0;color-scheme:light dark">
<p>${message}</p>`;

const DONE_PAGE = page('Signed in', 'Done. You can close this tab and go back to your terminal.');
const FAILED_PAGE = page('Sign-in failed', 'That did not complete. Go back to your terminal and try again.');

/**
 * A loopback listener that resolves with the code the browser brings back.
 *
 * On 127.0.0.1 explicitly rather than every interface: a server on `0.0.0.0` is reachable from the network, and what
 * it holds is an authorization code. `state` tells this flow's answer from anything else that reaches the port.
 */
const awaitCode = (
  state: string
): Promise<{ close: () => Promise<void>; port: number; code: Promise<string | undefined> }> =>
  new Promise(resolve => {
    let settle: (value: string | undefined) => void = () => undefined;
    const code = new Promise<string | undefined>(done => {
      settle = done;
    });

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();

        return;
      }

      const returned = url.searchParams.get('code') ?? undefined;
      const ok = returned !== undefined && url.searchParams.get('state') === state;
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
      res.end(ok ? DONE_PAGE : FAILED_PAGE);
      settle(ok ? returned : undefined);
    });

    const close = () =>
      new Promise<void>(done => {
        server.closeAllConnections();
        server.close(() => done());
      });

    server.listen(0, '127.0.0.1', () => {
      // A listening server always has an address object; only a pipe's is a string.
      resolve({ close, port: (server.address() as AddressInfo).port, code });
    });
  });

/**
 * The person's own browser, at `url`. Printed as well by the caller: over SSH, or with no browser at all, the link is
 * opened by hand — and a failure to start one here is nothing to stop over.
 */
export const openBrowser = (url: string): void => {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? // `start` goes through cmd, which reads `&` in the query as a command separator.
          ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];

  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // Nothing to open it with: the printed link is the way.
  }
};

const grantOf = (clientId: string, token: TokenResponse, previousRefresh?: string): GrantResult => {
  if (!token.access_token) {
    return { ok: false, reason: 'refused', error: token.error_description ?? token.error };
  }

  return {
    ok: true,
    grant: {
      clientId,
      accessToken: token.access_token,
      // The server may rotate it; when it does not, the one presented is still the grant's.
      refreshToken: token.refresh_token ?? previousRefresh,
      expiresAt: token.expires_in !== undefined ? Math.floor(Date.now() / 1000) + token.expires_in : undefined,
      target: token.target
    }
  };
};

export interface SignInOptions {
  /** `space` to have the person choose a space on the grant screen. */
  scope?: string;
  /** Told the address to open, which it opens and prints. Replaced in tests by a browser that answers on its own. */
  open: (url: string) => void;
}

export const signInThroughBrowser = async (apiUrl: string, { scope, open }: SignInOptions): Promise<GrantResult> => {
  const discovered = await discover(apiUrl);
  if (!discovered.ok) {
    return { ok: false, reason: 'unreachable', error: discovered.error };
  }

  const { endpoints } = discovered;
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  const state = base64url(randomBytes(16));

  const { close, port, code } = await awaitCode(state);
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  try {
    const registered = await requestJson<{ client_id?: string; error?: string; error_description?: string }>(
      endpoints.registration_endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ client_name: clientName(), software_id: 'plitzi-cli', redirect_uris: [redirectUri] })
      }
    );
    if (!registered.ok) {
      return { ok: false, reason: 'unreachable', error: registered.error };
    }

    const clientId = registered.data.client_id;
    if (!clientId) {
      return {
        ok: false,
        reason: 'refused',
        error: registered.data.error_description ?? registered.data.error ?? 'The server would not register the CLI.'
      };
    }

    const authorize = new URL(endpoints.authorization_endpoint);
    authorize.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      ...(scope ? { scope } : {})
    }).toString();

    open(authorize.toString());

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<undefined>(done => {
      timer = setTimeout(() => done(undefined), FLOW_TIMEOUT_MS);
    });
    const returned = await Promise.race([code, timeout]);
    clearTimeout(timer);
    if (!returned) {
      return { ok: false, reason: 'timeout' };
    }

    const exchanged = await postForm<TokenResponse>(endpoints.token_endpoint, {
      grant_type: 'authorization_code',
      code: returned,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      client_id: clientId
    });
    if (!exchanged.ok) {
      return { ok: false, reason: 'unreachable', error: exchanged.error };
    }

    return grantOf(clientId, exchanged.data);
  } finally {
    await close();
  }
};

/** A new session for the same grant. The CLI holds a refresh token and never the person's password. */
export const renewGrant = async (apiUrl: string, grant: Grant): Promise<GrantResult> => {
  if (!grant.refreshToken) {
    return { ok: false, reason: 'refused', error: 'This session cannot be renewed.' };
  }

  const discovered = await discover(apiUrl);
  if (!discovered.ok) {
    return { ok: false, reason: 'unreachable', error: discovered.error };
  }

  const renewed = await postForm<TokenResponse>(discovered.endpoints.token_endpoint, {
    grant_type: 'refresh_token',
    refresh_token: grant.refreshToken,
    client_id: grant.clientId
  });
  // A server that could not be reached is NOT a refusal: a laptop off the network must not sign anybody out.
  if (!renewed.ok) {
    return { ok: false, reason: 'unreachable', error: renewed.error };
  }

  return grantOf(grant.clientId, renewed.data, grant.refreshToken);
};

/**
 * Ending the grant, not just forgetting it here: the refresh token could mint another session, so a sign-out that only
 * deleted the file would leave a credential alive that a copy of the file could still use. RFC 7009 answers success
 * either way, so this answers nothing.
 */
export const revokeGrant = async (apiUrl: string, grant: Grant): Promise<void> => {
  const discovered = await discover(apiUrl);
  if (!discovered.ok || !discovered.endpoints.revocation_endpoint || !grant.refreshToken) {
    return;
  }

  await postForm(discovered.endpoints.revocation_endpoint, {
    token: grant.refreshToken,
    token_type_hint: 'refresh_token',
    client_id: grant.clientId
  });
};
