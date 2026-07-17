import { gql } from '@apollo/client/core';

import type { Element } from '../../../../../../types';

export type TSpaceUpdateElementSubscription = {
  element: Element;
};

const SpaceUpdateElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdateElement(environment: $environment) {
      element {
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

export default SpaceUpdateElementSubscription;
