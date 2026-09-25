import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { isBlockedHost } from '@plitzi/sdk-server/kernel';

/**
 * Whether an ADDRESS is never the public internet. The ranges are sdk-server's, the same rule its `http.request` task
 * and connector engine follow: this module used to keep its own copy, and the copy judged `::ffff:7f00:1` — the form a
 * URL parser writes `[::ffff:127.0.0.1]` in — as public. Anything that is not an address is refused here; a NAME is
 * judged by what it resolves to, in `isPublicHost`.
 */
export const isPrivateAddress = (address: string): boolean => isIP(address) === 0 || isBlockedHost(address);

const PRIVATE_SUFFIXES = ['.local', '.internal', '.localhost', '.home.arpa'];

/** Does this hostname resolve somewhere on the public internet? The endpoint fetches URLs an agent authored, so
 *  without this it would be a way to read whatever the pod itself can reach — the cluster's services, the cloud
 *  metadata endpoint, a database on the node. Both the literal address and every address the name resolves to are
 *  checked; a name that does not resolve is refused rather than handed to fetch. */
export const isPublicHost = async (hostname: string): Promise<boolean> => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || PRIVATE_SUFFIXES.some(suffix => host.endsWith(suffix))) {
    return false;
  }

  if (isIP(host)) {
    return !isPrivateAddress(host);
  }

  try {
    const addresses = await lookup(host, { all: true });

    return addresses.length > 0 && addresses.every(entry => !isPrivateAddress(entry.address));
  } catch {
    return false;
  }
};
