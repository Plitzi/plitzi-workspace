import { gql } from '@apollo/client/core';

const StyleUpdatedSubscription = gql`
  subscription ($environment: String!) {
    StyleUpdated(environment: $environment) {
      platform
      variables
      cache
    }
  }
`;

export default StyleUpdatedSubscription;
