import { gql } from '@apollo/client/core';

import type { DropPosition, Element } from '@plitzi/sdk-shared';

export type TSegmentCloneElementSubscription = {
  contextId: string;
  element: Element;
  dropPosition: DropPosition;
  to: string;
  initialItems: Record<string, Element>;
};

const SegmentCloneElementSubscription = gql`
  subscription ($environment: String!) {
    SegmentCloneElement(environment: $environment) {
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
    }
  }
`;

export default SegmentCloneElementSubscription;
