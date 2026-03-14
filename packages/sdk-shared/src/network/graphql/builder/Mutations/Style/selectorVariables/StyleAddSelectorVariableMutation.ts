import { gql } from '@apollo/client/core';

const StyleAddSelectorVariableMutation = gql`
  mutation StyleAddSelectorVariableMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $category: String!
    $name: String!
    $value: Json!
  ) {
    StyleAddSelectorVariable(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      category: $category
      name: $name
      value: $value
    ) {
      displayMode
      selector
      category
      name
      value
    }
  }
`;

export default StyleAddSelectorVariableMutation;
