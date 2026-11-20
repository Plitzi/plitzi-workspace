import { requestAuthority } from '@plitzi/sdk-kernel/http';
import { assignRollout, keptRollout, rolloutCookie } from '@plitzi/sdk-shared/flags';

import type { SSRRequest } from '@plitzi/sdk-kernel/types';
import type { Schema } from '@plitzi/sdk-shared';
import type { RolloutBuckets } from '@plitzi/sdk-shared/flags';

export type RequestRollout = {
  /** The visitor's place in every flag the space rolls out to part of its visitors. */
  buckets: RolloutBuckets;
  /** The `Set-Cookie` that keeps the places drawn for this visitor just now: their page is theirs alone. */
  setCookie?: string;
};

/**
 * Where this request's visitor stands in the space's gradual rollouts: the places their cookie kept, and one drawn now
 * for a flag it does not hold — kept from this response on. A render nobody visits (a picture, a draft's unsaved edits)
 * draws nothing: a rollout's flag answers its own value there.
 */
export const requestRollout = (
  req: Pick<SSRRequest, 'headers' | 'protocol'>,
  flags: Schema['flags'],
  draws: boolean
): RequestRollout => {
  const host = requestAuthority(req);
  const kept = keptRollout(req.headers.cookie, host);
  if (!draws) {
    return { buckets: kept };
  }

  const { buckets, drawn } = assignRollout(flags, kept);
  if (drawn.length === 0) {
    return { buckets };
  }

  return { buckets, setCookie: rolloutCookie(host, buckets, { secure: req.protocol === 'https' }) };
};
