import { gql } from 'graphql-tag';

import type { SpaceRuntime } from '../../../../../types';

export type TSpaceRuntimeQuery = { SpaceRuntime: SpaceRuntime };

const SpaceRuntimeQuery = gql`
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
