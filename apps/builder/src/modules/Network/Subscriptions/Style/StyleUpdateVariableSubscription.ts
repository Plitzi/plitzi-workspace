import { gql } from '@apollo/client/core';

const StyleUpdateVariableSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdateVariable(environment: $environment) {
      variable
      value
    }
  }
`;

export default StyleUpdateVariableSubscription;
