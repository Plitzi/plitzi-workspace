// Packages
import { gql } from '@apollo/client/core';

const StyleUpdateSelectorMutation = gql`
  mutation StyleUpdateSelectorMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $path: String
    $style: Json
  ) {
    StyleUpdateSelector(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      path: $path
      style: $style
    ) {
      id
      platform
      cache
    }
  }
`;

export default StyleUpdateSelectorMutation;
