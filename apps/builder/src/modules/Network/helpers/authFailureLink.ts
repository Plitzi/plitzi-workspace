import { ServerError } from '@apollo/client';
import { ErrorLink } from '@apollo/client/link/error';

import { authFailureFromResponse, reportAuthFailure } from '@plitzi/sdk-shared/auth';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { hearPlatform } from './platformVersion';

const parseBody = (bodyText: string): unknown => {
  try {
    return JSON.parse(bodyText);
  } catch {
    return undefined;
  }
};

/**
 * Turns a GraphQL transport refusal into a session signal. A session dies at the server — revoked from another
 * device, an account deactivated — and the client finds out from whichever request happens to be refused next. This
 * is what makes that request count for something instead of surfacing as one failed query.
 *
 * Only transport-level refusals are read: a GraphQL error inside a 200 is the schema's business, not the session's.
 */
export const createAuthFailureLink = (uri?: string): ErrorLink =>
  new ErrorLink(({ error }) => {
    if (!ServerError.is(error)) {
      return;
    }

    const body = parseBody(error.bodyText);
    // Older than the platform takes: no request of this builder will be answered until it is reloaded.
    if (error.statusCode === 426) {
      hearPlatform({
        kind: 'outdated',
        message:
          isRecord(body) && typeof body.error === 'string' ? body.error : 'This builder is older than Plitzi takes.'
      });

      return;
    }

    const reason = authFailureFromResponse(error.statusCode, body);
    if (reason) {
      void reportAuthFailure({ reason, url: uri });
    }
  });
