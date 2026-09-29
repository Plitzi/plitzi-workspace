import { gql } from 'graphql-tag';

import type { ActionRunReport } from '../../../../../../types';

export type TSpaceRunActionMutation = ActionRunReport;

const SpaceRunActionMutation = gql`
  mutation SpaceRunActionMutation($identifier: String!, $input: Json, $trigger: String) {
    SpaceRunAction(identifier: $identifier, input: $input, trigger: $trigger) {
      runId
      status
      output
      trace
      steps
    }
  }
`;

export default SpaceRunActionMutation;
