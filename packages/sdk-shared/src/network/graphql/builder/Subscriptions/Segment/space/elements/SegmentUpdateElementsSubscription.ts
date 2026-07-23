import { gql } from '@apollo/client/core';

import type { Element } from '../../../../../../../types';

export type TSegmentUpdateElementsSubscription = {
  contextId: string;
  elements: Element[];
};

const SegmentUpdateElementsSubscription = gql`
  subscription ($environment: String!) {
    SegmentUpdateElements(environment: $environment) {
      contextId
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

export default SegmentUpdateElementsSubscription;
