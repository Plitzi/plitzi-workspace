import { gql } from '@apollo/client/core';

const StyleUpdateSelectorMutation = gql`
  mutation StyleUpdateSelectorMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $path: String
    $style: Json
    $params: Json!
  ) {
    StyleUpdateSelector(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      path: $path
      style: $style
      params: $params
    ) {
      displayMode
      selector
      type
      path
      style
      params
    }
  }
`;

export default StyleUpdateSelectorMutation;
