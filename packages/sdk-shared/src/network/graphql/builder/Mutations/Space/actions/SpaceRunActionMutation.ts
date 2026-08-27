import { gql } from '@apollo/client/core';

import type { ActionRunReport } from '../../../../../../types';

export type TSpaceRunActionMutation = ActionRunReport;

const SpaceRunActionMutation = gql`
  mutation SpaceRunActionMutation($identifier: String!, $input: Json, $trigger: String) {
    SpaceRunAction(identifier: $identifier, input: $input, trigger: $trigger) {
      runId
      status
      output
      trace
    }
  }
`;

export default SpaceRunActionMutation;
