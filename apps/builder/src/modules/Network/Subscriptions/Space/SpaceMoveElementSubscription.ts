// Packages
import { gql } from '@apollo/client/core';

const SpaceMoveElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceMoveElement(environment: $environment) {
      elementId
      from
      to
      dropPosition
    }
  }
`;

export default SpaceMoveElementSubscription;
