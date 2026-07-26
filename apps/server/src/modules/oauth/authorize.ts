import { renderConsentPage } from './consentPage';
import { AUTHORIZE_PATH } from './metadata';
import { field, optionalField } from './params';
import { randomId } from './pkce';
import { dropPending, getClient, getPending, putCode, putPending } from './records';
import { redirectWithCode, redirectWithError, sendErrorPage, sendHtml } from './respond';

import type { OAuthParams } from './params';
import type {
  OAuthConfig,
  OAuthConsentView,
  OAuthGrantTarget,
  OAuthGuestConfig,
  OAuthUser,
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

const renderConsent = async (config: OAuthConfig, res: SSRResponseHelpers, view: OAuthConsentView): Promise<void> => {
  const html = await (config.renderConsent ?? renderConsentPage)(view);

  sendHtml(res, 200, html);
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

/** GET /authorize — the entry point a host opens in the user's browser. */
export const handleAuthorizeStart = async (
  config: OAuthConfig,
  res: SSRResponseHelpers,
  params: OAuthParams
): Promise<void> => {
  const request = await resolveRequest(config, res, params);
  if (!request) {
    return;
  }

  await renderConsent(config, res, {
    step: 'credentials',
    action: AUTHORIZE_PATH,
    hidden: hiddenFieldsFor(request),
    targets: [],
    guest: config.guest ? guestView(config.guest) : undefined,
    branding: config.branding ?? {}
  });
};

/** POST /authorize — both steps of the form land here: the credentials submit, and the grant submit that carries
 *  the `pending` id proving the credentials step already passed. */
export const handleAuthorizeSubmit = async (
  config: OAuthConfig,
  res: SSRResponseHelpers,
  params: OAuthParams
): Promise<void> => {
  const request = await resolveRequest(config, res, params);
  if (!request) {
    return;
  }

  const pendingId = optionalField(params, 'pending');
  if (pendingId) {
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
      await renderConsent(config, res, {
        step: 'target',
        action: AUTHORIZE_PATH,
        hidden: hiddenFieldsFor(request, pendingId),
        targets,
        user: pending.user,
        error: 'Choose what to grant access to.',
        branding: config.branding ?? {}
      });

      return;
    }

    await dropPending(config.adapters.store, pendingId);
    await completeGrant(config, res, request, pending.user, chosen);

    return;
  }

  // The guest button. There is no identity to establish and nothing to choose, so the configured target is granted
  // straight away — one screen, no password, and the connection can only ever do what that target allows.
  const { guest } = config;
  if (guest && optionalField(params, 'guest')) {
    await completeGrant(config, res, request, guest.user ?? DEFAULT_GUEST_USER, guest.target);

    return;
  }

  const user = await config.adapters.authenticate({
    username: field(params, 'username'),
    password: field(params, 'password')
  });

  if (!user) {
    await renderConsent(config, res, {
      step: 'credentials',
      action: AUTHORIZE_PATH,
      hidden: hiddenFieldsFor(request),
      targets: [],
      guest: guest ? guestView(guest) : undefined,
      error: 'Those credentials did not match an account.',
      branding: config.branding ?? {}
    });

    return;
  }

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

  const nextPendingId = randomId();
  await putPending(config.adapters.store, nextPendingId, {
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    challenge: request.challenge,
    state: request.state,
    scope: request.scope,
    user
  });

  await renderConsent(config, res, {
    step: 'target',
    action: AUTHORIZE_PATH,
    hidden: hiddenFieldsFor(request, nextPendingId),
    targets,
    user,
    branding: config.branding ?? {}
  });
};
