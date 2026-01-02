import { gql } from '@apollo/client/core';

export type TSpaceRemoveElementSubscription = { elementId: string };

const SpaceRemoveElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceRemoveElement(environment: $environment) {
      elementId
    }
  }
`;

export default SpaceRemoveElementSubscription;
