import { gql } from 'graphql-tag';

const StyleRemoveFontMutation = gql`
  mutation StyleRemoveFontMutation($environment: String!, $family: String!) {
    StyleRemoveFont(environment: $environment, family: $family) {
      family
    }
  }
`;

export default StyleRemoveFontMutation;
