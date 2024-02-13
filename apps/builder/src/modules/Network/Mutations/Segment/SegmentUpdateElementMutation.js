// Packages
import { gql } from '@apollo/client/core';

const SegmentUpdateElementMutation = gql`
  mutation SegmentUpdateElementMutation($environment: String!, $element: Json!, $contextId: String!) {
    SegmentUpdateElement(environment: $environment, element: $element, contextId: $contextId) {
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
`;

export default SegmentUpdateElementMutation;
