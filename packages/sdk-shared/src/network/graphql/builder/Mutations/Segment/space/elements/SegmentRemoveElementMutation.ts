const SegmentRemoveElementMutation = /* GraphQL */ `
  mutation SegmentRemoveElementMutation($environment: String!, $elementId: String!, $contextId: String!) {
    SegmentRemoveElement(environment: $environment, elementId: $elementId, contextId: $contextId) {
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

export default SegmentRemoveElementMutation;
