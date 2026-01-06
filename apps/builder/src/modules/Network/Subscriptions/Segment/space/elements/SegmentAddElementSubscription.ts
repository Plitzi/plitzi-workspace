import { gql } from '@apollo/client/core';

import type { DropPosition, Element, SchemaVariable } from '@plitzi/sdk-shared';

export type TSegmentAddElementSubscription = {
  contextId: string;
  element: Element;
  dropPosition: DropPosition;
  to: string;
  initialItems: Record<string, Element>;
  variables: SchemaVariable[];
};

const SegmentAddElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentAddElement(environment: $environment) {
      contextId
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

export default SegmentAddElementSubscription;
