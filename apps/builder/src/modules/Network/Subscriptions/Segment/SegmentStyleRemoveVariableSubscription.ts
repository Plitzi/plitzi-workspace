import { gql } from '@apollo/client/core';

const SegmentStyleRemoveVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleRemoveVariable(environment: $environment) {
      variable
      contextId
    }
  }
`;

export default SegmentStyleRemoveVariableSubscription;
