import { gql } from 'graphql-tag';

const StyleAddFontMutation = gql`
  mutation StyleAddFontMutation($environment: String!, $font: Json!) {
    StyleAddFont(environment: $environment, font: $font) {
      family
    }
  }
`;

export default StyleAddFontMutation;
