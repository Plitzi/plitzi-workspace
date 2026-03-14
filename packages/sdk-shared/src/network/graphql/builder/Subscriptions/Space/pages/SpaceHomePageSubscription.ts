import { gql } from '@apollo/client/core';

import type { Element } from '../../../../../../types';

export type TSpaceHomePageSubscription = {
  page: Element;
};

const SpaceHomePageSubscription = gql`
  subscription ($environment: String!) {
    SpaceHomePage(environment: $environment) {
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

export default SpaceHomePageSubscription;
