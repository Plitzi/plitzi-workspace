// Packages
import { gql } from '@apollo/client/core';

const StyleUpdatedSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdated(environment: $environment) {
      id
      platform
      cache
    }
  }
`;

export default StyleUpdatedSubscription;
