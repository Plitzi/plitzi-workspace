// `createAuthFailureLink` is imported from `@plitzi/sdk-shared/auth/authFailureLink`, not from here: it needs
// `@apollo/client`, an optional peer, and this barrel is part of the root every server consumer loads.
export { authFailureFromResponse, onAuthFailure, reportAuthFailure, sameRegistrableDomain } from './failureChannel';
export { checkVisitorRoles, visitorAccess, VISITOR_NAME } from './visitorRoles';

export type { AuthFailureListener, AuthFailureSignal } from './failureChannel';
export type { VisitorRoles } from './visitorRoles';
