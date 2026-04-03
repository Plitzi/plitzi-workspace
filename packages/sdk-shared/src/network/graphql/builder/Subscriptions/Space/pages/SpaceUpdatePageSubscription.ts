import { gql } from '@apollo/client/core';

import type { Element } from '../../../../../../types';

export type TSpaceUpdatePageSubscription = {
  page: Element;
};

const SpaceUpdatePageSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdatePage(environment: $environment) {
      page {
        id
        definition {
          label
          type
          initialState
          styleSelectors
          bindings
          interactions
          parentId
          rootId
          items
        }
        attributes
      }
    }
  }
`;

export default SpaceUpdatePageSubscription;
