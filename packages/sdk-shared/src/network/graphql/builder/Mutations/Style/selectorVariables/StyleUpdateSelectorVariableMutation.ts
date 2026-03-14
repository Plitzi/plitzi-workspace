import { gql } from '@apollo/client/core';

const StyleUpdateSelectorVariableMutation = gql`
  mutation StyleUpdateSelectorVariableMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $category: String!
    $name: String!
    $value: Json!
  ) {
    StyleUpdateSelectorVariable(
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

export default StyleUpdateSelectorVariableMutation;
