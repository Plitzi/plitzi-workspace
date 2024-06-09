// Packages
import { gql } from '@apollo/client/core';

const SpaceRemoveVariableSubscription = gql`
  subscription ($environment: String!) {
    SpaceRemoveVariable(environment: $environment) {
      name
    }
  }
`;

export default SpaceRemoveVariableSubscription;
