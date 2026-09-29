import type { SpaceRuntime } from '../../../../../types';

export type TSpaceRuntimeQuery = { SpaceRuntime: SpaceRuntime };

const SpaceRuntimeQuery = /* GraphQL */ `
  query SpaceRuntimeQuery {
    SpaceRuntime {
      environments {
        environment
        revision
        digest
        status
        error
        stoppedReason
        idleStopsAt
        endpoints
        tasks
        startedAt
        size
      }
      variables
      idleMinutes
      sizes {
        name
        label
        cpu
        memory
        included
      }
    }
  }
`;

export default SpaceRuntimeQuery;
