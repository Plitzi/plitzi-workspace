import { renderConsentPage } from './consentPage';
import { AUTHORIZE_PATH } from './metadata';
import { field, optionalField } from './params';
import { randomId } from './pkce';
import { dropPending, getClient, getPending, putCode, putPending } from './records';
import { redirectToSignIn, redirectWithCode, redirectWithError, sendErrorPage, sendHtml } from './respond';

import type { OAuthParams } from './params';
import type {
  OAuthConfig,
  OAuthConsentView,
  OAuthGrantTarget,
  OAuthGuestConfig,
  OAuthUser,
  SSRRequest,
  SSRResponseHelpers
} from '@plitzi/sdk-shared';

const DEFAULT_CODE_TTL_SECONDS = 60;

const DEFAULT_GUEST_LABEL = 'Continue without an account';

// Nobody proved who this is, and the record says so: what the connection may do comes from the configured target,
// not from this identity.
const DEFAULT_GUEST_USER: OAuthUser = { id: 'guest', label: 'Guest' };

const guestView = (guest: OAuthGuestConfig): NonNullable<OAuthConsentView['guest']> => ({
  label: guest.label ?? DEFAULT_GUEST_LABEL,
  description: guest.target.description
});

/** The authorization request, as it survives the round trip through the consent form. Everything here comes from
 *  the client and is echoed back to it, so none of it is trusted beyond having been validated once on the way in. */
type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state?: string;
  scope?: string;
};

// The form must carry the whole request across the POST — the browser is the only thing connecting the two, and
// this server keeps no cookie session for a flow that is one page long.
const hiddenFieldsFor = (request: AuthorizationRequest, pendingId?: string): Record<string, string> => {
  // The challenge method rides along even though it is always S256: the POST re-runs the same validation as the
  // GET, and a field the form drops is a field the request no longer has.
  const hidden: Record<string, string> = {
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    code_challenge: request.challenge,
    code_challenge_method: 'S256'
  };

  if (request.state !== undefined) {
    hidden['state'] = request.state;
  }

  if (request.scope !== undefined) {
    hidden['scope'] = request.scope;
  }

  if (pendingId !== undefined) {
    hidden['pending'] = pendingId;
  }

  return hidden;
};

const renderConsent = (res: SSRResponseHelpers, view: OAuthConsentView): void => {
  sendHtml(res, 200, renderConsentPage(view));
};

/**
 * This request, as the address to come back to after signing in.
 *
 * Rebuilt from the params rather than read off `req.url` because the two can differ — a proxy may rewrite the
 * path — and what has to survive the round trip is the QUERY, which is the authorization request itself.
 */
const authorizeUrl = (config: OAuthConfig, req: SSRRequest, params: OAuthParams): string => {
  const base = config.issuer ?? `https://${req.headers.host ?? ''}`;
  const url = new URL(AUTHORIZE_PATH, base);
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
};

/**
 * The sign-in address with this request as the destination — what the grant screen's "sign in" link points at.
 *
 * `guest=1` rides along when this server would have taken somebody without an account, and it is the only thing
 * that tells the sign-in screen so. That screen is shared by every client now, most of which require an account,
 * so it cannot offer a way past itself by default — and without the hint, following the "sign in" link is a
 * ONE-WAY door: the person who clicks it to see what signing in involves has no way back to the guest button
 * except the browser's own history, on a page they arrived at from another application entirely.
 */
const signInWithReturn = (config: OAuthConfig, req: SSRRequest, params: OAuthParams): string => {
  const url = new URL(config.signInUrl);
  url.searchParams.set('redirect', authorizeUrl(config, req, params));

  if (config.guest) {
    url.searchParams.set('guest', '1');
  }

  return url.toString();
};

/** Validates the parts of an authorization request that decide WHERE a failure may be reported. Until the client
 *  and its redirect target check out, nothing may be sent back to the client. */
const resolveRequest = async (
  config: OAuthConfig,
  res: SSRResponseHelpers,
  params: OAuthParams
): Promise<AuthorizationRequest | undefined> => {
  const clientId = field(params, 'client_id');
  const redirectUri = field(params, 'redirect_uri');
  const client = clientId ? await getClient(config.adapters.store, clientId) : undefined;

  if (!client) {
    sendErrorPage(
      res,
      'Unknown client',
      'This application is not registered with the server, or its registration expired.'
    );

    return undefined;
  }

  if (!redirectUri || !client.redirectUris.includes(redirectUri)) {
    sendErrorPage(res, 'Invalid redirect', 'The application asked to be sent back to an address it did not register.');

    return undefined;
  }

  const state = optionalField(params, 'state');
  const responseType = field(params, 'response_type');
  if (responseType && responseType !== 'code') {
    redirectWithError(
      res,
      redirectUri,
      'unsupported_response_type',
      'Only the authorization code flow is supported.',
      state
    );

    return undefined;
  }

  const challenge = field(params, 'code_challenge');
  const method = field(params, 'code_challenge_method');
  if (!challenge || method !== 'S256') {
    redirectWithError(res, redirectUri, 'invalid_request', 'PKCE with code_challenge_method=S256 is required.', state);

    return undefined;
  }

  return { clientId, redirectUri, challenge, state, scope: optionalField(params, 'scope') };
};

/** Consent granted: mint the bearer now, park it behind a one-shot code and send the browser back. Minting here
 *  rather than at redemption keeps a failure the user can act on — no space, revoked access — on this screen. */
const completeGrant = async (
  config: OAuthConfig,
  res: SSRResponseHelpers,
  request: AuthorizationRequest,
  user: OAuthUser,
  target: OAuthGrantTarget
): Promise<void> => {
  const issued = await config.adapters.issueToken(user, target);
  if (!issued) {
    redirectWithError(
      res,
      request.redirectUri,
      'access_denied',
      'The account may not grant access to this resource.',
      request.state
    );

    return;
  }

  const code = randomId();
  await putCode(
    config.adapters.store,
    code,
    {
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      challenge: request.challenge,
      token: issued.token,
      expiresInSeconds: issued.expiresInSeconds,
      scope: request.scope,
      user,
      target
    },
    config.codeTtlSeconds ?? DEFAULT_CODE_TTL_SECONDS
  );

  redirectWithCode(res, request.redirectUri, code, request.state);
};

/**
 * Show a signed-in account what it may grant, and end the flow if there is nothing.
 *
 * `pendingId` is minted here because the screen it renders is the one that POSTs back, and the record is what
 * proves — on that POST — that identity was established before anything was granted.
 */
const askForTarget = async (
  config: OAuthConfig,
  res: SSRResponseHelpers,
  request: AuthorizationRequest,
  user: OAuthUser,
  error?: string
): Promise<void> => {
  const targets = await config.adapters.grantTargets(user);
  if (targets.length === 0) {
    redirectWithError(
      res,
      request.redirectUri,
      'access_denied',
      'This account has nothing to grant access to.',
      request.state
    );

    return;
  }

  const pendingId = randomId();
  await putPending(config.adapters.store, pendingId, {
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    challenge: request.challenge,
    state: request.state,
    scope: request.scope,
    user
  });

  renderConsent(res, {
    action: AUTHORIZE_PATH,
    hidden: hiddenFieldsFor(request, pendingId),
    targets,
    user,
    error,
    branding: config.branding ?? {}
  });
};

/**
 * GET /authorize — the entry point a host opens in the user's browser.
 *
 * This server does not ask for a password. It reads whoever the browser already is and, from there:
 *
 * - **signed in** — straight to the grant screen, which is the only page this module still renders. Choosing what
 *   to connect is authorization, and authorization is this server's job; who somebody is is not.
 * - **not signed in, guest allowed** — the grant screen with nothing to grant and the guest button on it. It is
 *   deliberately NOT a redirect: a guest has no session and never will, so bouncing them to sign in would take
 *   the option away from the only people it exists for.
 * - **not signed in, no guest** — off to `signInUrl`, carrying this whole request as where to come back to.
 */
export const handleAuthorizeStart = async (
  config: OAuthConfig,
  res: SSRResponseHelpers,
  params: OAuthParams,
  req: SSRRequest
): Promise<void> => {
  const request = await resolveRequest(config, res, params);
  if (!request) {
    return;
  }

  const user = await config.adapters.identify(req);
  if (user) {
    await askForTarget(config, res, request, user);

    return;
  }

  if (config.guest) {
    renderConsent(res, {
      action: AUTHORIZE_PATH,
      hidden: hiddenFieldsFor(request),
      targets: [],
      guest: guestView(config.guest),
      signInUrl: signInWithReturn(config, req, params),
      branding: config.branding ?? {}
    });

    return;
  }

  redirectToSignIn(res, config.signInUrl, authorizeUrl(config, req, params));
};

/**
 * POST /authorize — the grant screen coming back, either with a chosen target or with the guest button.
 *
 * There is no credentials branch any more: nothing here reads a username or a password, and the only way to reach
 * this with an identity is to carry a `pending` id that was minted after {@link OAuthAdapters.identify} succeeded.
 */
export const handleAuthorizeSubmit = async (
  config: OAuthConfig,
  res: SSRResponseHelpers,
  params: OAuthParams
): Promise<void> => {
  const request = await resolveRequest(config, res, params);
  if (!request) {
    return;
  }

  // The guest button. Nobody proved anything, so there is nothing to choose: the configured target is granted and
  // the connection can only ever do what that target allows.
  const { guest } = config;
  if (guest && optionalField(params, 'guest')) {
    await completeGrant(config, res, request, guest.user ?? DEFAULT_GUEST_USER, guest.target);

    return;
  }

  const pendingId = optionalField(params, 'pending');
  if (!pendingId) {
    redirectWithError(
      res,
      request.redirectUri,
      'invalid_request',
      'The grant was submitted without a session.',
      request.state
    );

    return;
  }

  const pending = await getPending(config.adapters.store, pendingId);
  // A pending record that expired or belongs to another client is not resumable; the user starts over.
  if (!pending || pending.clientId !== request.clientId) {
    redirectWithError(
      res,
      request.redirectUri,
      'access_denied',
      'The sign-in expired. Try connecting again.',
      request.state
    );

    return;
  }

  const targets = await config.adapters.grantTargets(pending.user);
  const chosen = targets.find(target => target.value === field(params, 'target'));
  if (!chosen) {
    // The record is dropped and a fresh one minted by askForTarget: a pending id is one attempt, so a screen
    // re-shown for a missing choice never leaves the previous one redeemable.
    await dropPending(config.adapters.store, pendingId);
    await askForTarget(config, res, request, pending.user, 'Choose what to grant access to.');

    return;
  }

  await dropPending(config.adapters.store, pendingId);
  await completeGrant(config, res, request, pending.user, chosen);
};
