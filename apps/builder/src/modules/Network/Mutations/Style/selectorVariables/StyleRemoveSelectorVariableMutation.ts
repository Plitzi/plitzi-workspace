import { gql } from '@apollo/client/core';

const StyleRemoveSelectorVariableMutation = gql`
  mutation StyleRemoveSelectorVariableMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $category: String!
    $name: String!
  ) {
    StyleRemoveSelectorVariable(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      category: $category
      name: $name
    ) {
      displayMode
      selector
      category
      name
    }
  }
`;

export default StyleRemoveSelectorVariableMutation;
