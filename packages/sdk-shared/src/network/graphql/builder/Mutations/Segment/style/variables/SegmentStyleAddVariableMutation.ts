const SegmentStyleAddVariableMutation = /* GraphQL */ `
  mutation SegmentStyleAddVariableMutation(
    $environment: String!
    $contextId: String!
    $category: String!
    $name: String!
    $value: Json!
  ) {
    SegmentStyleAddVariable(
      environment: $environment
      contextId: $contextId
      category: $category
      name: $name
      value: $value
    ) {
      contextId
      category
      name
      value
    }
  }
`;

export default SegmentStyleAddVariableMutation;
