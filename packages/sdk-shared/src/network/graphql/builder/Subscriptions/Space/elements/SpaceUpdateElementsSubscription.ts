import { gql } from '@apollo/client/core';

import type { Element } from '../../../../../../types';

export type TSpaceUpdateElementsSubscription = {
  elements: Element[];
};

const SpaceUpdateElementsSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdateElements(environment: $environment) {
      elements {
        id
        idRef
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

export default SpaceUpdateElementsSubscription;
