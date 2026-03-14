import { gql } from '@apollo/client/core';

import type { Element } from '../../../../../../types';

export type TSpaceAddPageSubscription = {
  page: Element;
};

const SpaceAddPageSubscription = gql`
  subscription ($environment: String!) {
    SpaceAddPage(environment: $environment) {
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

export default SpaceAddPageSubscription;
