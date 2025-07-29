import { gql } from '@apollo/client/core';

const StyleAddVariableSubscription = gql`
  subscription ($environment: String!) {
    StyleAddVariable(environment: $environment) {
      variable
      value
    }
  }
`;

export default StyleAddVariableSubscription;
