import { gql } from '@apollo/client/core';

import type { SchemaVariable, DropPosition, Element } from '@plitzi/sdk-shared';

export type TSpaceAddElementSubscription = {
  element: Element;
  dropPosition: DropPosition;
  to: string;
  initialItems?: Element[];
  variables?: SchemaVariable[];
};

const SpaceAddElementSubscription = gql`
  subscription ($environment: String!) {
    SpaceAddElement(environment: $environment) {
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
      variables {
        name
        category
        type
        value
        subValues {
          value
          when
        }
      }
    }
  }
`;

export default SpaceAddElementSubscription;
