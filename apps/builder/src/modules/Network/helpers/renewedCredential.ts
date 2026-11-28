import { reportAuthFailure } from '@plitzi/sdk-shared/auth';

import type { Credential } from './credential';
import type { AuthFailureSignal } from '@plitzi/sdk-shared/auth';

/** How long a renewed session may take to reach the builder from the page that renewed it. */
export const RENEWED_CREDENTIAL_WAIT_MS = 3000;

/**
 * A credential of the builder's that was refused — a request's or a socket's — said to auth, and the credential that
 * replaced it once the page hands it over. Undefined when auth did not renew (a session that ended) or when the page
 * never passed the renewed token: whoever asked keeps the refusal.
 *
 * The refused credential goes with the report, so a refusal of one already replaced — a request that left just before
 * a renewal landed — is answered by that renewal instead of starting another that would rotate the token again.
 */
export const renewedCredential = async (
  credential: Credential,
  sent: string,
  signal: Omit<AuthFailureSignal, 'credential'>
): Promise<string | undefined> => {
  if (!(await reportAuthFailure({ ...signal, credential: sent }))) {
    return undefined;
  }

  const renewed = await credential.next(sent, RENEWED_CREDENTIAL_WAIT_MS);
  if (renewed === sent) {
    console.warn(
      `[builder] The session was renewed, but no new credential reached the builder within ` +
        `${String(RENEWED_CREDENTIAL_WAIT_MS)} ms: ${signal.url ?? 'what was refused'} stays refused. The page that ` +
        'embeds the builder must pass the renewed token as its `userKey`.'
    );

    return undefined;
  }

  return renewed;
};
