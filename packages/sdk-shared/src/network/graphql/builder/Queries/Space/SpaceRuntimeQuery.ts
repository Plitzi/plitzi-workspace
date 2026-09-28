import { gql } from '@apollo/client/core';

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
        endpoints
        tasks
        startedAt
      }
      variables
    }
  }
`;

export default SpaceRuntimeQuery;
