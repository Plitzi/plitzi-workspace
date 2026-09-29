const SegmentUpdateElementsMutation = /* GraphQL */ `
  mutation SegmentUpdateElementsMutation($environment: String!, $elements: [Json!]!, $contextId: String!) {
    SegmentUpdateElements(environment: $environment, elements: $elements, contextId: $contextId) {
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

export default SegmentUpdateElementsMutation;
