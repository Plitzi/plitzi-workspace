// Packages
import { gql } from '@apollo/client/core';

const SpaceAddVariableSubscription = gql`
  subscription ($environment: String!) {
    SpaceAddVariable(environment: $environment) {
      variable {
        name
        description
        category
        type
        value
        when
      }
    }
  }
`;

export default SpaceAddVariableSubscription;
