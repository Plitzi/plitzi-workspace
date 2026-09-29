const StyleAddSelectorMutation = /* GraphQL */ `
  mutation StyleAddSelectorMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $type: String!
    $path: String
    $style: Json
    $params: Json!
  ) {
    StyleAddSelector(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      type: $type
      path: $path
      style: $style
      params: $params
    ) {
      displayMode
      selector
      type
      path
      style
      params
    }
  }
`;

export default StyleAddSelectorMutation;
