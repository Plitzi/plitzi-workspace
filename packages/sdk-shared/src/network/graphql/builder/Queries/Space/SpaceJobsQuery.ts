import type { PageInfo, SpaceJob } from '../../../../../types';

export type TSpaceJobsQuery = {
  SpaceJobs: { edges: SpaceJob[]; pageInfo: PageInfo };
};

/** The space's queue, most recently touched first: its actions' queued runs and its functions' jobs. */
const SpaceJobsQuery = /* GraphQL */ `
  query SpaceJobsQuery($kind: String, $name: String, $status: String, $page: Int, $pageSize: Int) {
    SpaceJobs(kind: $kind, name: $name, status: $status, page: $page, pageSize: $pageSize) {
      edges {
        id
        environment
        kind
        name
        trigger
        startedBy
        status
        progress
        step
        error
        attempts
        maxAttempts
        activeMs
        pauseRequested
        cancelRequested
        key
        missed
        dueAt
        createdAt
        updatedAt
      }
      pageInfo {
        hasPrevPage
        hasNextPage
        from
        to
        total
      }
    }
  }
`;

export default SpaceJobsQuery;
