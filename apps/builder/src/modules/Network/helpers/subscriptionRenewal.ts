import { CloseCode } from 'graphql-ws';

import { authFailureFromResponse } from '@plitzi/sdk-shared/auth';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { renewedCredential } from './renewedCredential';

import type { Credential } from './credential';

const MAX_BACKOFF_MS = 30_000;

/** graphql-ws's own wait between attempts — doubling from a second, jittered — held to half a minute at most. */
const backoff = (retries: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, Math.min(1000 * 2 ** retries, MAX_BACKOFF_MS) + 300 + Math.random() * 2700);
  });

/** How the subscriptions server says a connection's session was refused: `Forbidden`, the refusal's reason with it. */
const sessionRefusal = (event: unknown): string | undefined =>
  isRecord(event) && event.code === CloseCode.Forbidden && typeof event.reason === 'string' ? event.reason : undefined;

/**
 * What keeps the builder's subscriptions alive across a renewal of the person's session. The server checks the
 * credential a connection was opened with, and closes it (`Forbidden`) when the session refuses it — a token that
 * expired while the tab slept, or one a renewal replaced: the client then connects again on its own, and asks again
 * for every subscription it held.
 *
 * Each connection is opened with the credential the builder holds then (`credentialToSend`); a refusal is said to
 * auth with the one it carried, and the next attempt waits for that renewal instead of a backoff, opening with what
 * it handed over. A renewed credential refused again before any connection was accepted is not the session's doing:
 * nothing is renewed for it, and the client backs off as for any other failure.
 */
export const subscriptionRenewal = (credential: Credential, url: string) => {
  let sent = credential.current;
  let renewal: Promise<string | undefined> | undefined;
  let renewedTo: string | undefined;

  return {
    credentialToSend: () => {
      sent = credential.current;

      return sent;
    },
    retryWait: async (retries: number) => {
      const pending = renewal;
      renewal = undefined;
      if (pending && (await pending)) {
        return;
      }

      await backoff(retries);
    },
    on: {
      connected: () => {
        renewedTo = undefined;
      },
      closed: (event: unknown) => {
        const reason = sessionRefusal(event);
        if (reason === undefined) {
          return;
        }

        if (sent === renewedTo) {
          console.warn(
            `[builder] The subscriptions were refused again (${reason}) with the credential a renewal had just ` +
              'handed them: they keep trying with a growing wait, and live edits from others may lag until then.'
          );

          return;
        }

        renewal = renewedCredential(credential, sent, {
          reason: authFailureFromResponse(401, { reason }) ?? 'expired',
          url
        }).then(renewed => {
          renewedTo = renewed;

          return renewed;
        });
      }
    }
  };
};
