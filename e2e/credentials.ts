import { createTokens } from '@plitzi/sdk-server/auth';

import { liveCredentials } from './backend';

/** The two credentials the builder boots with, minted here instead of pasted in.
 *
 *  A mocked run needs them to be READABLE, not valid: the app decodes the space token to learn which space it is
 *  editing, and nothing on the other end ever verifies the signature — there is no other end. So the suite signs
 *  its own with a secret that means nothing anywhere, and stops depending on a literal in `index.html` that
 *  expires a day after somebody pasted it.
 *
 *  A live run is the opposite: only the deployment's own secret produces a token its server will accept, so
 *  `PLITZI_WEB_KEY` / `PLITZI_USER_KEY` from `yarn token 1 --user admin` win whenever they are set. */

const ORIGIN = 'http://127.0.0.1:8080';

const tokens = createTokens({
  secret: 'e2e-not-a-real-secret',
  issuer: ORIGIN,
  audience: [ORIGIN]
});

export const SPACE_ID = 1;

export const builderCredentials = (): { webKey: string; userKey: string } => {
  if (liveCredentials.webKey && liveCredentials.userKey) {
    return { webKey: liveCredentials.webKey, userKey: liveCredentials.userKey };
  }

  return {
    webKey: tokens.generateSpaceToken(SPACE_ID, [ORIGIN], 'render'),
    userKey: tokens.generateUserToken(1)
  };
};
