/**
 * OAuth 2.1 authorization, as a mechanism.
 *
 * Discovery, dynamic client registration, PKCE, the one-shot code and the token endpoint — the whole protocol,
 * and none of the policy. A deployment supplies {@link OAuthAdapters}: who the browser already is, what they may
 * grant, and the credential to mint. What that credential IS decides what the flow is FOR, and this server is
 * mounted more than once for exactly that reason — the MCP connector grants a space-scoped agent token, while the
 * platform's own native clients (the desktop app, the CLI) grant a user session. Same protocol, same screens,
 * different `issueToken`.
 *
 * It lived inside the MCP server while it had one caller. It is here now because the line this repo draws is that
 * sdk-server owns the MECHANISM and a consumer owns the data — and a grant flow that only one app can mount is a
 * mechanism trapped in a consumer.
 */

export { handleAuthorizeStart, handleAuthorizeSubmit } from './core/oauth/authorize';
export { bearerOf, sendChallenge } from './core/oauth/challenge';
export {
  authorizationServerMetadata,
  AUTHORIZATION_SERVER_PATH,
  AUTHORIZE_PATH,
  protectedResourceMetadata,
  PROTECTED_RESOURCE_PATH,
  REGISTER_PATH,
  TOKEN_PATH
} from './core/oauth/metadata';
export { randomId, verifyChallenge } from './core/oauth/pkce';
export { dropPending, getAccess, getClient, getPending, putCode, putPending } from './core/oauth/records';
export { handleRegister } from './core/oauth/register';
export { redirectToSignIn, redirectWithCode, redirectWithError, sendErrorJson, sendJson } from './core/oauth/respond';
export { handleRevoke, handleToken } from './core/oauth/token';
export { createOAuthGuardStage, createOAuthStage } from './core/http/stages/oauth';

export type { OAuthParams } from './core/oauth/params';
