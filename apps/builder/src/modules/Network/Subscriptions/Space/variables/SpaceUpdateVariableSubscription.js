// Packages
import { gql } from '@apollo/client/core';

const SpaceUpdateVariableSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdateVariable(environment: $environment) {
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

export default SpaceUpdateVariableSubscription;
