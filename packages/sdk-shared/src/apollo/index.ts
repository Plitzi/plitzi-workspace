/**
 * The Apollo links a GraphQL client of the platform is built with. `@apollo/client` is an optional peer, so they are
 * an entry of their own and never part of the package's root, which every server consumer loads.
 */
export * from './authFailureLink';
export * from './stripTypename';
