import { gql } from '@apollo/client/core';

const StyleUpdateSelectorVariableMutation = gql`
  mutation StyleUpdateSelectorVariableMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $category: String!
    $name: String!
    $value: String!
  ) {
    StyleUpdateSelectorVariable(
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

export default StyleUpdateSelectorVariableMutation;
