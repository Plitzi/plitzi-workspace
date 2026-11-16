import type { SpaceReleases } from '../../../../../types';

export type TSpaceReleasesQuery = { SpaceReleases: SpaceReleases };

/** A domain's releases, newest first, and the rollback they offer. */
const SpaceReleasesQuery = /* GraphQL */ `
  query SpaceReleasesQuery($domain: String!, $limit: Int) {
    SpaceReleases(domain: $domain, limit: $limit) {
      releases {
        id
        domain
        environment
        revision
        followsLatest
        previous {
          environment
          revision
        }
        kind
        by {
          id
          username
        }
        at
      }
      rollback {
        environment
        revision
      }
    }
  }
`;

export default SpaceReleasesQuery;
