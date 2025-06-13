// Packages
import { gql } from '@apollo/client/core';

const SegmentStyleAddVariableSubscription = gql`
  subscription ($environment: String!) {
    SegmentStyleAddVariable(environment: $environment) {
      variable
      value
      contextId
    }
  }
`;

export default SegmentStyleAddVariableSubscription;
