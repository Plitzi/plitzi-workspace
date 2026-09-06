import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

import { shell } from 'electron';

import type { AddressInfo } from 'node:net';

/**
 * Signing in, the way a native application is supposed to: in the browser, never in this window.
 *
 * The app opens the person's own browser at the platform's `/authorize`, waits on a loopback address for the
 * answer, and exchanges a one-shot code for a session. What it never does is see a password — so it cannot store
 * one, leak one, or check one wrongly; MFA and social sign-in work without it knowing they exist; and a session
 * revoked anywhere is revoked here.
 *
 * The redirect is `http://127.0.0.1:<port>` because that is what RFC 8252 prescribes for a native app: unlike a
 * custom scheme, no other application on the machine can claim it, and the port is chosen by the OS at the moment
 * the flow starts. PKCE is what binds the code to THIS process — the loopback address is not a secret, so the
 * verifier is the only thing that proves the code came back to whoever asked for it.
 */

const base64url = (buffer: Buffer): string => buffer.toString('base64url');

/** How long the window waits for somebody to finish in the browser before giving the port back. */
const FLOW_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Mirrors `SignInReply` on the renderer's side, which is the contract this crosses to.
 *
 * `clientId` travels with the session because a native client registers PER FLOW — the redirect declares a
 * loopback port the OS picked this time — so renewing later needs the registration the grant was issued to. IPC
 * is untyped at the boundary, so nothing but this would have caught it missing.
 */
export type SignInResult =
  | { ok: true; clientId: string; accessToken: string; refreshToken?: string; expiresIn?: number }
  | { ok: false; reason: 'cancelled' | 'timeout' | 'refused'; error?: string };

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type ClientRegistration = { client_id?: string };

/** What the browser is sent back to, and the page it lands on. Plain text: nobody reads it for long. */
const CLOSING_PAGE = `<!doctype html><meta charset="utf-8"><title>Signed in</title>
<body style="font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0">
<p>You are signed in. You can close this tab and go back to Plitzi.</p>`;

const FAILED_PAGE = `<!doctype html><meta charset="utf-8"><title>Sign-in failed</title>
<body style="font:15px system-ui;display:grid;place-items:center;height:100vh;margin:0">
<p>That sign-in did not complete. Go back to Plitzi and try again.</p>`;

/**
 * A loopback listener that resolves with the code the browser brings back.
 *
 * It binds 127.0.0.1 explicitly rather than every interface: a server on `0.0.0.0` is reachable from the network,
 * and what it is holding is an authorization code.
 */
const awaitCode = (
  state: string
): Promise<{ server: ReturnType<typeof createServer>; port: number; code: Promise<string | undefined> }> =>
  new Promise(resolve => {
    let settle: (value: string | undefined) => void = () => undefined;
    const code = new Promise<string | undefined>(done => {
      settle = done;
    });

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      // Anything but the one path the flow was sent to — a favicon, a probe — is not an answer.
      if (!url.pathname.startsWith('/callback')) {
        res.writeHead(404).end();

        return;
      }

      // `state` is what tells this flow's answer from anything else that reaches the port while it is open.
      const returned = url.searchParams.get('code') ?? undefined;
      const ok = returned !== undefined && url.searchParams.get('state') === state;
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(ok ? CLOSING_PAGE : FAILED_PAGE);
      settle(ok ? returned : undefined);
    });

    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: (server.address() as AddressInfo).port, code });
    });
  });

const post = async <T>(url: string, body: Record<string, string>): Promise<T | undefined> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString()
    });

    return (await response.json()) as T;
  } catch {
    return undefined;
  }
};

/**
 * This application, registered with the authorization server.
 *
 * Registered on every sign-in rather than once and remembered: the loopback PORT is part of the redirect a client
 * declares, and it is a different port every time — chosen by the OS when the flow starts, because a fixed one is
 * a port that may already be taken.
 */
const register = async (apiUrl: string, redirectUri: string): Promise<string | undefined> => {
  try {
    const response = await fetch(`${apiUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Plitzi Desktop', redirect_uris: [redirectUri] })
    });
    const registration = (await response.json()) as ClientRegistration;

    return registration.client_id;
  } catch {
    return undefined;
  }
};

export const signInThroughBrowser = async (apiUrl: string): Promise<SignInResult> => {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  const state = base64url(randomBytes(16));

  const { server, port, code } = await awaitCode(state);
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  const close = () =>
    new Promise<void>(done => {
      server.close(() => done());
    });

  try {
    const clientId = await register(apiUrl, redirectUri);
    if (!clientId) {
      return { ok: false, reason: 'refused', error: 'This server would not register the app.' };
    }

    const authorize = new URL(`${apiUrl}/authorize`);
    authorize.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state
    }).toString();

    await shell.openExternal(authorize.toString());

    const timeout = new Promise<undefined>(done => {
      setTimeout(() => done(undefined), FLOW_TIMEOUT_MS);
    });
    const returned = await Promise.race([code, timeout]);
    if (!returned) {
      return { ok: false, reason: 'timeout' };
    }

    const token = await post<TokenResponse>(`${apiUrl}/token`, {
      grant_type: 'authorization_code',
      code: returned,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      client_id: clientId
    });

    if (!token?.access_token) {
      return { ok: false, reason: 'refused', error: token?.error_description ?? token?.error };
    }

    return {
      ok: true,
      clientId,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in
    };
  } finally {
    await close();
  }
};

/** Renewing, at the same endpoint. The app holds a refresh token and never the person's password. */
export const renewThroughToken = async (
  apiUrl: string,
  clientId: string,
  refreshToken: string
): Promise<SignInResult> => {
  const token = await post<TokenResponse>(`${apiUrl}/token`, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId
  });

  if (!token?.access_token) {
    return { ok: false, reason: 'refused', error: token?.error_description ?? token?.error };
  }

  return {
    ok: true,
    clientId,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in
  };
};

/**
 * Ending the grant, not just the session.
 *
 * Signing out revokes the SESSION, which is what the access token is. The refresh token is a separate thing the
 * authorization server holds, and it can mint another session — so a sign-out that only cleared the window would
 * leave a credential alive that a leaked copy could still use.
 *
 * Answers nothing: RFC 7009 says the endpoint reports success either way, and a sign-out that can fail is one
 * people learn to ignore.
 */
export const revokeGrant = async (apiUrl: string, clientId: string, refreshToken: string): Promise<void> => {
  await post(`${apiUrl}/revoke`, { token: refreshToken, token_type_hint: 'refresh_token', client_id: clientId });
};

export default signInThroughBrowser;
