// Packages
import { gql } from '@apollo/client/core';

const StyleRemoveVariableSubscription = gql`
  subscription ($environment: String!) {
    StyleRemoveVariable(environment: $environment) {
      variable
    }
  }
`;

export default StyleRemoveVariableSubscription;
