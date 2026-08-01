import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// Ranges that never name something on the public internet: loopback, link-local (169.254.169.254 is the cloud
// metadata endpoint), the private blocks, CGNAT, benchmarking, multicast and reserved space.
const isPrivateIpv4 = (address: string): boolean => {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a = 0, b = 0] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
};

const isPrivateIpv6 = (address: string): boolean => {
  const normalized = address.toLowerCase().split('%')[0] ?? '';
  // Node reports IPv4 peers of a dual-stack host in the mapped form; the embedded address is the one to judge.
  if (normalized.startsWith('::ffff:') && normalized.includes('.')) {
    return isPrivateIpv4(normalized.slice(7));
  }

  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
};

export const isPrivateAddress = (address: string): boolean =>
  isIP(address) === 6 ? isPrivateIpv6(address) : isPrivateIpv4(address);

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
