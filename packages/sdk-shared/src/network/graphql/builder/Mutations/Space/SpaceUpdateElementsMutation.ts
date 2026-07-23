import { gql } from '@apollo/client/core';

const SpaceUpdateElementsMutation = gql`
  mutation SpaceUpdateElements($environment: String!, $elements: [Json!]!) {
    SpaceUpdateElements(environment: $environment, elements: $elements) {
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

export default SpaceUpdateElementsMutation;
