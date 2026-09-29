const SegmentStyleRemoveVariableMutation = /* GraphQL */ `
  mutation SegmentStyleRemoveVariableMutation(
    $environment: String!
    $contextId: String!
    $category: String!
    $name: String!
  ) {
    SegmentStyleRemoveVariable(environment: $environment, contextId: $contextId, category: $category, name: $name) {
      contextId
      category
      name
    }
  }
`;

export default SegmentStyleRemoveVariableMutation;
