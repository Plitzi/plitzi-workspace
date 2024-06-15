// Packages
import { gql } from '@apollo/client/core';

const SpaceAddVariableSubscription = gql`
  subscription ($environment: String!) {
    SpaceAddVariable(environment: $environment) {
      variable {
        name
        category
        type
        value
        when
        whenSuccessValue
        whenFailValue
      }
    }
  }
`;

export default SpaceAddVariableSubscription;
