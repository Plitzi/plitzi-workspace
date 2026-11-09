export { reachSpaceInside, reachOwnServer } from './inside';
export { isBlockedHost, privateOriginsOf, assertOutboundAllowed, fetchOutbound, cappedResponse } from './outboundGuard';

export type { OwnServer } from './inside';
export type { HostLookup, OutboundOptions } from './outboundGuard';
