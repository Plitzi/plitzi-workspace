import { gql } from '@apollo/client/core';

const SpaceRemoveElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceRemoveElement(environment: $environment) {
      elementId
    }
  }
`;

export default SpaceRemoveElementSubscription;
