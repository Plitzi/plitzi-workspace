// Packages
import { gql } from '@apollo/client/core';

const StyleUpdateSelectorSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdateSelector(environment: $environment) {
      displayMode
      selector
      path
      style
    }
  }
`;

export default StyleUpdateSelectorSubscription;
