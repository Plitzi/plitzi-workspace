import { gql } from '@apollo/client/core';

export type TSpaceRemovePageSubscription = {
  pageId: string;
};

const SpaceRemovePageSubscription = gql`
  subscription ($environment: String!) {
    SpaceRemovePage(environment: $environment) {
      pageId
    }
  }
`;

export default SpaceRemovePageSubscription;
