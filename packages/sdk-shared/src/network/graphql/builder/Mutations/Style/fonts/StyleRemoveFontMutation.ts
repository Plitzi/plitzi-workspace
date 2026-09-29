const StyleRemoveFontMutation = /* GraphQL */ `
  mutation StyleRemoveFontMutation($environment: String!, $family: String!) {
    StyleRemoveFont(environment: $environment, family: $family) {
      family
    }
  }
`;

export default StyleRemoveFontMutation;
