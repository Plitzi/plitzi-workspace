import { ServerError } from '@apollo/client';
import { ErrorLink } from '@apollo/client/link/error';

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
 * A builder older than the platform takes (426): no request of it will be answered until it is reloaded, and the
 * builder says so. A refused credential is not this link's: `renewingFetch` says it to auth, under every request.
 */
export const createOutdatedLink = (): ErrorLink =>
  new ErrorLink(({ error }) => {
    if (!ServerError.is(error) || error.statusCode !== 426) {
      return;
    }

    const body = parseBody(error.bodyText);
    hearPlatform({
      kind: 'outdated',
      message:
        isRecord(body) && typeof body.error === 'string' ? body.error : 'This builder is older than Plitzi takes.'
    });
  });
