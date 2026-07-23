import { gql } from '@apollo/client/core';

const SegmentUpdateElementsMutation = gql`
  mutation SegmentUpdateElementsMutation($environment: String!, $elements: [Json!]!, $contextId: String!) {
    SegmentUpdateElements(environment: $environment, elements: $elements, contextId: $contextId) {
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
`;

export default SegmentUpdateElementsMutation;
