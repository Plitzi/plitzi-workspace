import { gql } from 'graphql-tag';

import type { ActionRunReport } from '../../../../../../types';

export type TSpaceTryFunctionMutation = ActionRunReport;

const SpaceTryFunctionMutation = gql`
  mutation SpaceTryFunctionMutation($task: String!, $params: Json) {
    SpaceTryFunction(task: $task, params: $params) {
      runId
      status
      output
      trace
      steps
    }
  }
`;

export default SpaceTryFunctionMutation;
