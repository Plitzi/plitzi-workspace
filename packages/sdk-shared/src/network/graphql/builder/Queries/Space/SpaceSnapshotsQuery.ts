import type { SpaceSnapshot } from '../../../../../types';

export type TSpaceSnapshotsQuery = { SpaceSnapshots: SpaceSnapshot[] };

/** An environment's snapshots, newest first, with who made each and the domains serving it. */
const SpaceSnapshotsQuery = /* GraphQL */ `
  query SpaceSnapshotsQuery($environment: String!, $limit: Int) {
    SpaceSnapshots(environment: $environment, limit: $limit) {
      environment
      revision
      description
      publishedAt
      by {
        id
        username
      }
      domains
    }
  }
`;

export default SpaceSnapshotsQuery;
