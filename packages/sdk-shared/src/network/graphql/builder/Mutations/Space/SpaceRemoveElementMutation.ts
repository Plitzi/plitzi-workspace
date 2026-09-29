const SpaceRemoveElementMutation = /* GraphQL */ `
  mutation SpaceRemoveElementMutation($environment: String!, $elementId: String!) {
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
