// Packages
import { gql } from '@apollo/client/core';

const SpaceUpdateVariableSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdateVariable(environment: $environment) {
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

export default SpaceUpdateVariableSubscription;
