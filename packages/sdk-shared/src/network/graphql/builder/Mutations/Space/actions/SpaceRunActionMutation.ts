import { gql } from '@apollo/client/core';

import type { ActionRunReport } from '../../../../../../types';

export type TSpaceRunActionMutation = ActionRunReport;

const SpaceRunActionMutation = gql`
  mutation SpaceRunActionMutation($identifier: String!, $input: Json) {
    SpaceRunAction(identifier: $identifier, input: $input) {
      runId
      status
      output
      trace
    }
  }
`;

export default SpaceRunActionMutation;
