import { csrfCookieName } from '@plitzi/sdk-kernel/identity';

import type { SSRPageServerConfig } from '../../types';
import type { Environment } from '@plitzi/sdk-shared';
import type { CsrfHint } from '@plitzi/sdk-shared/csrf';

/**
 * What a page is told about the CSRF token its writes to the deployment's own APIs echo: those APIs, the cookie each
 * keeps it in, and where a new one is handed out (`rsc.visitorCredentials`) — as JSON, for `<meta name="plitzi-csrf">`.
 * Only on the pages of a space trusted to carry its visitors' sessions there; none where the deployment names no
 * `csrfPath`.
 */
export const csrfHintFor = async (
  config: SSRPageServerConfig,
  space: { spaceId: number; environment: Environment }
): Promise<string | undefined> => {
  const visitor = config.rsc?.visitorCredentials;
  if (!visitor?.csrfPath || visitor.origins.length === 0) {
    return undefined;
  }

  if (visitor.spaces && !(await visitor.spaces(space))) {
    return undefined;
  }

  const hint: CsrfHint = {
    apis: visitor.origins.map(origin => ({
      origin,
      cookie: csrfCookieName(new URL(origin).hostname, config.authCookie)
    })),
    path: visitor.csrfPath
  };

  return JSON.stringify(hint);
};
