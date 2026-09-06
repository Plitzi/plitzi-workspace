import { gql } from '@apollo/client/core';

const StyleUpdateFontMutation = gql`
  mutation StyleUpdateFontMutation($environment: String!, $family: String!, $font: Json!) {
    StyleUpdateFont(environment: $environment, family: $family, font: $font) {
      family
    }
  }
`;

export default StyleUpdateFontMutation;
