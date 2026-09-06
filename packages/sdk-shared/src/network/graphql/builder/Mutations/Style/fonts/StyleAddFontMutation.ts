import { gql } from '@apollo/client/core';

const StyleAddFontMutation = gql`
  mutation StyleAddFontMutation($environment: String!, $font: Json!) {
    StyleAddFont(environment: $environment, font: $font) {
      family
    }
  }
`;

export default StyleAddFontMutation;
