const StyleAddFontMutation = /* GraphQL */ `
  mutation StyleAddFontMutation($environment: String!, $font: Json!) {
    StyleAddFont(environment: $environment, font: $font) {
      family
    }
  }
`;

export default StyleAddFontMutation;
