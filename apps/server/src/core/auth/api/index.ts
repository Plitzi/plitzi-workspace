import { accountsFlows } from './accounts';
import { adminFlows } from './admin';
import { createAuthContext } from './context';
import { factorsFlows } from './factors';
import { profileFlows } from './profile';
import { sessionFlows } from './session';

import type { Identity } from '../identity';
import type { Tokens } from '../tokens';
import type { AccountAdapters, AuthApiConfig } from './types';

export type * from './types';

/**
 * The HTTP surface of authentication, as functions rather than routes.
 *
 * Nothing here knows about Express, or about this server's own pipeline: a handler is given what the request
 * carried and answers what should be sent, including whether the session cookies should be written or cleared. The
 * binding does the rest, which is what lets the same login live behind an API endpoint and behind a rendered page's
 * form without either owning it.
 */
export const createAuthApi = ({
  tokens,
  identity,
  adapters,
  config = {}
}: {
  tokens: Tokens;
  identity: Identity;
  adapters: AccountAdapters;
  config?: AuthApiConfig;
}) => {
  const ctx = createAuthContext({ tokens, identity, adapters, config });

  return {
    ...sessionFlows(ctx),
    ...factorsFlows(ctx),
    ...accountsFlows(ctx),
    ...profileFlows(ctx),
    ...adminFlows(ctx),
    /**
     * The same exchange, answering in accounts rather than in HTTP.
     *
     * A page server needs who came back and the session they got; the flow above needs a body and a status. They
     * are the same act, and the translation between them has one correct answer — so it is made once, here, rather
     * than by every deployment that wires an external identity provider into a rendered page.
     */
    exchangeAccount: ctx.exchangeAccount,
    /** Exposed so a deployment can mint a session outside the flows above — a rendered page's login form. */
    issueSession: ctx.issue,
    resolveActor: identity.resolveActor
  };
};

export type AuthApi = ReturnType<typeof createAuthApi>;
