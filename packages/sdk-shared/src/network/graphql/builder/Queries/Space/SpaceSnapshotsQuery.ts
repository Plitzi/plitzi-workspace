import type { SpaceSnapshot } from '../../../../../types';

export type TSpaceSnapshotsQuery = { SpaceSnapshots: SpaceSnapshot[] };

/** An environment's snapshots, newest first, with who made each, the domains serving it and its preview address. */
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
      previewUrl
    }
  }
`;

export default SpaceSnapshotsQuery;
