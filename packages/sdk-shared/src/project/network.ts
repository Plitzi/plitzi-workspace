import type { NetworkInterfaceInfo } from 'node:os';

/**
 * This machine as another device on its network reaches it — a phone on the same Wi-Fi opening the project's server —
 * said once for the server, which prints where to open it, and the CLI, which makes a certificate naming it.
 */

/** Its IPv4 addresses on the network (`os.networkInterfaces()`): what a phone opens it by today. */
export const networkAddresses = (interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): string[] =>
  Object.values(interfaces)
    .flat()
    .flatMap(entry => (entry && entry.family === 'IPv4' && !entry.internal ? [entry.address] : []));

/**
 * The name mDNS gives it (`os.hostname()` → `studio.local`), which outlives the address the router hands it: a
 * certificate made for it still serves after the address changes.
 */
export const localNetworkName = (machine: string): string => `${(machine.split('.').at(0) ?? '').toLowerCase()}.local`;
