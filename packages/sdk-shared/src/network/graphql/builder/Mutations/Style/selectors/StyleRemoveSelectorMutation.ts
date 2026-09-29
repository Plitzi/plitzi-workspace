const StyleRemoveSelectorMutation = /* GraphQL */ `
  mutation StyleRemoveSelectorMutation($environment: String!, $displayMode: String, $selector: String!) {
    StyleRemoveSelector(environment: $environment, displayMode: $displayMode, selector: $selector) {
      displayMode
      selector
    }
  }
`;

export default StyleRemoveSelectorMutation;
