import { gql } from '@apollo/client/core';

const StyleAddSelectorVariableMutation = gql`
  mutation StyleAddSelectorVariableMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $category: String!
    $name: String!
    $value: String!
  ) {
    StyleAddSelectorVariable(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      category: $category
      name: $name
      value: $value
    ) {
      id
      variables
      platform
      mode
      cache
    }
  }
`;

export default StyleAddSelectorVariableMutation;
