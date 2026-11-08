import type { SSRRequest, SSRResponseHelpers } from '../types';
import type { SSRUser } from '@plitzi/sdk-shared';

/**
 * Who a request is, as every server that serves a space asks it (RFC 0032, §11 Q6): one object, so a page server and a
 * worker are configured with the same answer. `createAuth` makes one (`ssrIdentityAdapters`); a deployment with its own
 * accounts writes its own. Absent, every request is a guest's.
 */
export type RequestIdentity = {
  /**
   * The person a request carries a live session for, with the roles and permissions it was granted; else nobody. With
   * `res`, a session cookie found over for good is cleared on it (`SSRAdapters.getUser`).
   */
  getUser: (req: SSRRequest, res?: SSRResponseHelpers) => Promise<SSRUser | undefined>;
};
