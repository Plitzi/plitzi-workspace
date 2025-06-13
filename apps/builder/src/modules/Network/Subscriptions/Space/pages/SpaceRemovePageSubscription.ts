// Packages
import { gql } from '@apollo/client/core';

const SpaceRemovePageSubscription = gql`
  subscription ($environment: String!) {
    SpaceRemovePage(environment: $environment) {
      pageId
    }
  }
`;

export default SpaceRemovePageSubscription;
