import { getClient } from './records';
import { forwardedIp } from '../requestParser';

import type { OAuthConfig, OAuthIssueContext, SSRRequest } from '@plitzi/sdk-shared';

/**
 * What `issueToken` is told about who it issues to, beyond the person: the application, as it registered, and the
 * request the credential is issued on.
 *
 * The application is read from its registration rather than trusted from the request — a client names itself once,
 * when it registers, and every credential its grants mint carries that name. A registration that has aged out of the
 * store (a grant renewed for longer than the client record lives) is still an application, just an unnamed one.
 */
export const issueContextFor = async (
  config: OAuthConfig,
  clientId: string,
  extra: { req?: SSRRequest; replaces?: string } = {}
): Promise<OAuthIssueContext> => {
  const client = await getClient(config.adapters.store, clientId);
  const userAgent = extra.req?.headers['user-agent'];
  const ip = extra.req ? (extra.req.ip ?? forwardedIp(extra.req.headers)) : '';
  const request = {
    ...(typeof userAgent === 'string' && userAgent ? { userAgent } : {}),
    ...(ip ? { ip } : {})
  };

  return {
    client: {
      clientId,
      name: client?.clientName ?? 'Unnamed application',
      ...(client?.softwareId ? { softwareId: client.softwareId } : {})
    },
    ...(request.userAgent || request.ip ? { request } : {}),
    ...(extra.replaces ? { replaces: extra.replaces } : {})
  };
};
