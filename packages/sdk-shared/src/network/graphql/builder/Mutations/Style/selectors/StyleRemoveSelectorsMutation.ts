import { gql } from 'graphql-tag';

const StyleRemoveSelectorsMutation = gql`
  mutation StyleRemoveSelectorsMutation($environment: String!, $displayMode: String, $selectors: [String!]!) {
    StyleRemoveSelectors(environment: $environment, displayMode: $displayMode, selectors: $selectors) {
      displayMode
      selectors
    }
  }
`;

export default StyleRemoveSelectorsMutation;
