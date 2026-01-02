import { gql } from '@apollo/client/core';

import type { Element } from '@plitzi/sdk-shared';

export type TSpaceUpdateElementSubscription = {
  element: Element;
};

const SpaceUpdateElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceUpdateElement(environment: $environment) {
      element {
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

export default SpaceUpdateElementSubscription;
