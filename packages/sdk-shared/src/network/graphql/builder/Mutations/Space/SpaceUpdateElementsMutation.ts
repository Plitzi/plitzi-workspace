const SpaceUpdateElementsMutation = /* GraphQL */ `
  mutation SpaceUpdateElementsMutation($environment: String!, $elements: [Json!]!) {
    SpaceUpdateElements(environment: $environment, elements: $elements) {
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

export default SpaceUpdateElementsMutation;
