import { gql } from '@apollo/client/core';

const SpaceRemoveElementMutation = gql`
  mutation SpaceRemoveElement($environment: String!, $elementId: String!) {
    SpaceRemoveElement(environment: $environment, elementId: $elementId) {
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

export default SpaceRemoveElementMutation;
