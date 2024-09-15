// Packages
import { gql } from '@apollo/client/core';

const SegmentStyleUpdateVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleUpdateVariable(environment: $environment) {
      variable
      value
      contextId
    }
  }
`;

export default SegmentStyleUpdateVariableSubscription;
