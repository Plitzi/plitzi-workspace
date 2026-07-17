import { gql } from '@apollo/client/core';

const SpaceUpdateElementMutation = gql`
  mutation SpaceUpdateElement($environment: String!, $element: Json!) {
    SpaceUpdateElement(environment: $environment, element: $element) {
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

export default SpaceUpdateElementMutation;
