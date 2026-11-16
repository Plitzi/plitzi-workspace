import type { SpaceTargets } from '../../../../../types';

export type TSpaceTargetsQuery = { SpaceTargets: SpaceTargets };

/** The space's targets: how each domain serves it and where it stands, the providers, the plan's limits (RFC 0034). */
const SpaceTargetsQuery = /* GraphQL */ `
  query SpaceTargetsQuery {
    SpaceTargets
  }
`;

export default SpaceTargetsQuery;
