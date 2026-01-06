import { gql } from '@apollo/client/core';

import type { DropPosition, Element, SchemaVariable } from '@plitzi/sdk-shared';

export type TSegmentAddElementSubscription = {
  element: Element;
  dropPosition: DropPosition;
  to: string;
  initialItems: string[];
  variables: SchemaVariable[];
  contextId: string;
};

const SegmentAddElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentAddElement(environment: $environment) {
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
      contextId
    }
  }
`;

export default SegmentAddElementSubscription;
