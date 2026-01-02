import { gql } from '@apollo/client/core';

import type { DropPosition, Element } from '@plitzi/sdk-shared';

export type TSpaceCloneElementSubscription = {
  to: string;
  element: Element;
  dropPosition: DropPosition;
  initialItems: Element[];
};

const SpaceCloneElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceCloneElement(environment: $environment) {
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
      dropPosition
      to
      initialItems
    }
  }
`;

export default SpaceCloneElementSubscription;
