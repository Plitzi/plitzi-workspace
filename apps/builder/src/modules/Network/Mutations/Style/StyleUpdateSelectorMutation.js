// Packages
import { gql } from '@apollo/client/core';

const StyleUpdateSelectorMutation = gql`
  mutation StyleUpdateSelectorMutation(
    $environment: String!
    $displayMode: String!
    $selector: String!
    $type: String!
    $path: String
    $style: Json
  ) {
    StyleUpdateSelector(
      environment: $environment
      displayMode: $displayMode
      selector: $selector
      type: $type
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
