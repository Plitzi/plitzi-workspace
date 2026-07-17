import { gql } from '@apollo/client/core';

import type { DropPosition, Element, SchemaVariable } from '../../../../../../../types';

export type TSegmentUpdateElementSubscription = {
  contextId: string;
  element: Element;
  dropPosition: DropPosition;
  to: string;
  initialItems: string[];
  variables: SchemaVariable[];
};

const SegmentUpdateElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentUpdateElement(environment: $environment) {
      contextId
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

export default SegmentUpdateElementSubscription;
