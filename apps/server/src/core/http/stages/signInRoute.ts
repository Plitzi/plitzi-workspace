import { createHash, randomBytes } from 'node:crypto';

import { readCookies } from '../../auth/credentials';
import { appendCookies, writeSessionCookies } from '../../auth/session';
import { requestOrigin } from '../../requestParser';
import { safeRedirectTarget } from '../navigation';

import type { Stage } from '../types';
import type { SSRRequest, SSRResponseHelpers, SSRSignInConfig } from '@plitzi/sdk-shared';

/**
 * Signing a visitor in by redirect (`config.signIn`): out to an authorization server, back with a code, and a session
 * of this host's own made from it through `exchangeCredential`.
 *
 * Everything that decides whether the person may sign in, and into what, is the authorization server's and the
 * exchange adapter's. What is here is the part that is the same for any of them: registering this host as a client,
 * PKCE, the state that ties the callback to the browser that started, and never sending anybody off-site on the way
 * back.
 */

/**
 * The flow's state, in the browser that started it. `__Host-` is the point: a cookie with that prefix cannot carry a
 * Domain, so a sibling host — another space on the same parent domain — cannot plant one and finish a sign-in it
 * started in this browser, as whoever it signed in as.
 */
const STATE_COOKIE = '__Host-sign-in';

const STATE_TTL_SECONDS = 600;

type SignInState = { state: string; verifier: string; returnTo: string };

const base64url = (bytes: Buffer): string => bytes.toString('base64url');

const readState = (req: SSRRequest): SignInState | undefined => {
  const raw = readCookies(req)[STATE_COOKIE];
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf-8')) as Partial<SignInState>;

    return typeof parsed.state === 'string' &&
      typeof parsed.verifier === 'string' &&
      typeof parsed.returnTo === 'string'
      ? { state: parsed.state, verifier: parsed.verifier, returnTo: parsed.returnTo }
      : undefined;
  } catch {
    return undefined;
  }
};

const stateCookie = (value: string, maxAge: number): string =>
  `${STATE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/**
 * The client id this host is registered under, per authorization server and redirect address. Registration is
 * idempotent there — the same metadata is the same client — so each process asks once and keeps the answer.
 */
const clients = new Map<string, Promise<string>>();

const clientFor = (signIn: SSRSignInConfig, redirectUri: string, hostname: string): Promise<string> => {
  const key = `${signIn.registerUrl} ${redirectUri}`;
  const known = clients.get(key);
  if (known) {
    return known;
  }

  const registering = (async () => {
    const response = await fetch(signIn.registerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: hostname,
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none'
      })
    });
    const body = (await response.json()) as { client_id?: unknown };
    if (!response.ok || typeof body.client_id !== 'string') {
      throw new Error(`Registering ${hostname} with the authorization server failed (${response.status})`);
    }

    return body.client_id;
  })();
  clients.set(key, registering);
  // A failed registration is not remembered, so the next sign-in tries again.
  registering.catch(() => clients.delete(key));

  return registering;
};

const redirect = (res: SSRResponseHelpers, location: string): true => {
  res.setStatus(303);
  res.setHeader('Location', location);
  res.end();

  return true;
};

export const signInStage: Stage = async ctx => {
  const { config, req, res } = ctx;
  const { signIn } = config;
  if (!signIn || req.method !== 'GET') {
    return false;
  }

  const path = signIn.path ?? '/auth/sign-in';
  const callbackPath = `${path}/callback`;
  if (req.path !== path && req.path !== callbackPath) {
    return false;
  }

  const { exchangeCredential, getSpaceDeployment } = config.adapters;
  const origin = requestOrigin(req);
  if (!exchangeCredential || !getSpaceDeployment || !origin) {
    res.setStatus(404);
    res.end();

    return true;
  }

  const redirectUri = `${origin}${callbackPath}`;

  if (req.path === path) {
    const deployment = await getSpaceDeployment(req);
    if (typeof deployment.spaceId !== 'number') {
      res.setStatus(404);
      res.end();

      return true;
    }

    const clientId = await clientFor(signIn, redirectUri, req.hostname);
    const verifier = base64url(randomBytes(32));
    const state = base64url(randomBytes(16));
    const flow: SignInState = { state, verifier, returnTo: safeRedirectTarget(req, 'return') };
    appendCookies(res, [stateCookie(base64url(Buffer.from(JSON.stringify(flow))), STATE_TTL_SECONDS)]);

    const authorize = new URL(signIn.authorizeUrl);
    authorize.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: signIn.scope(deployment.spaceId),
      state,
      code_challenge: base64url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256'
    }).toString();

    return redirect(res, authorize.toString());
  }

  // The callback. The state is spent whatever happens next: one sign-in, one attempt.
  const flow = readState(req);
  appendCookies(res, [stateCookie('', 0)]);
  const code = req.query['code'];
  if (!flow || !code || req.query['state'] !== flow.state) {
    // Declined at the grant screen, expired, or started somewhere else: the visitor goes back as they were.
    return redirect(res, flow?.returnTo ?? '/');
  }

  const token = await fetch(signIn.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: await clientFor(signIn, redirectUri, req.hostname),
      code_verifier: flow.verifier
    }).toString()
  });
  const granted = (await token.json()) as { access_token?: unknown };
  if (!token.ok || typeof granted.access_token !== 'string') {
    return redirect(res, flow.returnTo);
  }

  const result = await exchangeCredential(signIn.provider, granted.access_token, req);
  if (result.ok) {
    writeSessionCookies(req, res, result.session, config.authCookie);
  }

  return redirect(res, flow.returnTo);
};
