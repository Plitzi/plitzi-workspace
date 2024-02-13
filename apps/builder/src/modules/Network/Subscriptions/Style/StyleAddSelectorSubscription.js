// Packages
import { gql } from '@apollo/client/core';

const StyleAddSelectorSubscription = gql`
  subscription ($environment: String!) {
    StyleAddSelector(environment: $environment) {
      displayMode
      selector
      path
      style
    }
  }
`;

export default StyleAddSelectorSubscription;
