const SpaceAddSnippetMutation = /* GraphQL */ `
  mutation SpaceAddSnippetMutation(
    $environment: String!
    $element: Json!
    $style: Json
    $dropPosition: String!
    $to: String!
    $initialItems: [Json]!
    $variables: [SpaceVariableInput]
  ) {
    SpaceAddSnippet(
      environment: $environment
      element: $element
      style: $style
      dropPosition: $dropPosition
      to: $to
      initialItems: $initialItems
      variables: $variables
    ) {
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

export default SpaceAddSnippetMutation;
